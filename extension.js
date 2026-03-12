const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
let screenshot = null;
let sharp = null;

// Lazy load screenshot-desktop and sharp to avoid errors if not installed
try {
	screenshot = require('screenshot-desktop');
} catch (error) {
	console.log('screenshot-desktop not installed. Screenshot feature will be disabled.');
}

try {
	sharp = require('sharp');
	console.log('sharp module loaded successfully');
} catch (error) {
	console.error('Failed to load sharp module:', error.message);
	console.log('sharp not installed. Image cropping will be disabled.');
}

// Data Storage Manager
class TestDataManager {
	constructor(context) {
		this.context = context;
	}

	getProjects() {
		return this.context.globalState.get('testProjects', []);
	}

	saveProjects(projects) {
		return this.context.globalState.update('testProjects', projects);
	}

	addProject(project) {
		const projects = this.getProjects();
		projects.push(project);
		return this.saveProjects(projects);
	}

	updateProject(projectId, updatedProject) {
		const projects = this.getProjects();
		const index = projects.findIndex(p => p.id === projectId);
		if (index !== -1) {
			projects[index] = updatedProject;
			return this.saveProjects(projects);
		}
		return Promise.resolve();
	}

	deleteProject(projectId) {
		const projects = this.getProjects();
		const filtered = projects.filter(p => p.id !== projectId);
		return this.saveProjects(filtered);
	}

	getProject(projectId) {
		const projects = this.getProjects();
		return projects.find(p => p.id === projectId);
	}
}

// Tree Item Classes
class ProjectTreeItem extends vscode.TreeItem {
	constructor(project) {
		super(project.name, vscode.TreeItemCollapsibleState.Collapsed);
		this.contextValue = 'project';
		this.project = project;
		
		const status = this.getProjectStatus();
		
		// Set icon based on project status
		if (status.allPassed) {
			this.iconPath = new vscode.ThemeIcon('pass', new vscode.ThemeColor('testing.iconPassed'));
		} else if (status.anyFailed) {
			this.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('testing.iconFailed'));
		} else if (status.anyExecuted) {
			this.iconPath = new vscode.ThemeIcon('folder-opened');
		} else {
			this.iconPath = new vscode.ThemeIcon('folder');
		}
		
		const parts = [`${this.getRequirementCount()} requirements`];
		if (status.allPassed) {
			parts.push('✓ All Passed');
		} else if (status.totalExecuted > 0) {
			parts.push(`${status.totalPassed}/${status.totalExecuted} passed`);
		}
		this.description = parts.join(' | ');
	}

	getRequirementCount() {
		return this.project.requirements ? this.project.requirements.length : 0;
	}
	
	getProjectStatus() {
		let totalTests = 0;
		let totalExecuted = 0;
		let totalPassed = 0;
		let allRequirementsPassed = true;
		let hasRequirements = false;
		
		if (this.project.requirements && this.project.requirements.length > 0) {
			hasRequirements = true;
			for (const req of this.project.requirements) {
				if (req.testCases && req.testCases.length > 0) {
					let reqAllExecuted = true;
					let reqAllPassed = true;
					
					for (const tc of req.testCases) {
						totalTests++;
						if (tc.executed) {
							totalExecuted++;
							if (tc.passed) {
								totalPassed++;
							} else {
								reqAllPassed = false;
							}
						} else {
							reqAllExecuted = false;
							reqAllPassed = false;
						}
					}
					
					if (!reqAllExecuted || !reqAllPassed) {
						allRequirementsPassed = false;
					}
				} else {
					allRequirementsPassed = false;
				}
			}
		} else {
			allRequirementsPassed = false;
		}
		
		return {
			allPassed: hasRequirements && totalTests > 0 && totalTests === totalExecuted && totalExecuted === totalPassed && allRequirementsPassed,
			anyFailed: totalExecuted > 0 && totalPassed < totalExecuted,
			anyExecuted: totalExecuted > 0,
			totalTests,
			totalExecuted,
			totalPassed
		};
	}
}

class RequirementTreeItem extends vscode.TreeItem {
	constructor(requirement, projectId) {
		super(requirement.name, vscode.TreeItemCollapsibleState.Collapsed);
		this.contextValue = 'requirement';
		this.requirement = requirement;
		this.projectId = projectId;
		
		const status = this.getRequirementStatus();
		
		// Set icon based on requirement status
		if (status.allPassed) {
			this.iconPath = new vscode.ThemeIcon('pass', new vscode.ThemeColor('testing.iconPassed'));
		} else if (status.anyFailed) {
			this.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('testing.iconFailed'));
		} else if (status.anyExecuted) {
			this.iconPath = new vscode.ThemeIcon('file-text');
		} else {
			this.iconPath = new vscode.ThemeIcon('file-text');
		}
		
		const parts = [`${this.getTestCaseCount()} test cases`];
		if (status.allPassed) {
			parts.push('✓ All Passed');
		} else if (status.executed > 0) {
			parts.push(`${status.passed}/${status.executed} passed`);
		}
		this.description = parts.join(' | ');
		
		let tooltip = requirement.name;
		if (requirement.description) {
			tooltip += `\n\n${requirement.description}`;
		}
		if (status.allPassed) {
			tooltip += '\n\n✓ All test cases passed';
		} else if (status.anyFailed) {
			tooltip += `\n\n✗ ${status.executed - status.passed} test case(s) failed`;
		}
		this.tooltip = tooltip;
	}

	getTestCaseCount() {
		return this.requirement.testCases ? this.requirement.testCases.length : 0;
	}
	
	getRequirementStatus() {
		let total = 0;
		let executed = 0;
		let passed = 0;
		
		if (this.requirement.testCases && this.requirement.testCases.length > 0) {
			for (const tc of this.requirement.testCases) {
				total++;
				if (tc.executed) {
					executed++;
					if (tc.passed) {
						passed++;
					}
				}
			}
		}
		
		return {
			allPassed: total > 0 && total === executed && executed === passed,
			anyFailed: executed > 0 && passed < executed,
			anyExecuted: executed > 0,
			total,
			executed,
			passed
		};
	}
}

class TestCaseTreeItem extends vscode.TreeItem {
	constructor(testCase, projectId, requirementId) {
		super(testCase.name, vscode.TreeItemCollapsibleState.None);
		this.contextValue = 'testCase';
		this.testCase = testCase;
		this.projectId = projectId;
		this.requirementId = requirementId;
		
		// Set icon based on test status
		if (testCase.executed) {
			this.iconPath = new vscode.ThemeIcon(
				testCase.passed ? 'pass' : 'error',
				testCase.passed ? new vscode.ThemeColor('testing.iconPassed') : new vscode.ThemeColor('testing.iconFailed')
			);
		} else {
			this.iconPath = new vscode.ThemeIcon('circle-outline');
		}

		// Build description
		const parts = [];
		if (testCase.executed) {
			parts.push(testCase.passed ? '✓ Passed' : '✗ Failed');
		} else {
			parts.push('Not executed');
		}
		if (testCase.evidences && testCase.evidences.length > 0) {
			parts.push(`${testCase.evidences.length} evidence(s)`);
		}
		this.description = parts.join(' | ');
		
		// Tooltip
		let tooltip = `${testCase.name}\n\nExpected Result: ${testCase.expectedResult}`;
		if (testCase.executed) {
			tooltip += `\n\nExecuted by: ${testCase.executedBy}`;
			tooltip += `\nDate: ${testCase.executionDate}`;
			tooltip += `\nStatus: ${testCase.passed ? 'Passed' : 'Failed'}`;
			if (testCase.observations) {
				tooltip += `\nObservations: ${testCase.observations}`;
			}
		}
		this.tooltip = tooltip;
	}
}

// TreeView Provider
class TestProjectsProvider {
	constructor(dataManager) {
		this.dataManager = dataManager;
		this._onDidChangeTreeData = new vscode.EventEmitter();
		this.onDidChangeTreeData = this._onDidChangeTreeData.event;
	}

	refresh() {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element) {
		return element;
	}

	getChildren(element) {
		if (!element) {
			// Root level - show projects
			const projects = this.dataManager.getProjects();
			return Promise.resolve(projects.map(p => new ProjectTreeItem(p)));
		} else if (element instanceof ProjectTreeItem) {
			// Show requirements
			const requirements = element.project.requirements || [];
			return Promise.resolve(requirements.map(r => 
				new RequirementTreeItem(r, element.project.id)
			));
		} else if (element instanceof RequirementTreeItem) {
			// Show test cases
			const testCases = element.requirement.testCases || [];
			return Promise.resolve(testCases.map(tc => 
				new TestCaseTreeItem(tc, element.projectId, element.requirement.id)
			));
		}
		return Promise.resolve([]);
	}
}

// Crop Editor Helper Functions
async function openCropEditor(imagePath, workspaceFolder) {
	return new Promise((resolve) => {
		let resolved = false; // Flag to prevent multiple resolves
		
		const panel = vscode.window.createWebviewPanel(
			'imageCrop',
			'Crop Screenshot',
			vscode.ViewColumn.One,
			{
				enableScripts: true,
				localResourceRoots: [vscode.Uri.file(path.dirname(imagePath))]
			}
		);

		const imageUri = panel.webview.asWebviewUri(vscode.Uri.file(imagePath));

		panel.webview.html = getCropEditorHTML(imageUri);

		// Handle messages from the webview
		panel.webview.onDidReceiveMessage(
			async message => {
				switch (message.command) {
					case 'crop':
						try {
							console.log('Crop command received with data:', message.cropData);
							
							if (!sharp) {
								const errorMsg = 'Sharp module not available. Please ensure sharp is installed by running: npm install\n\nThen reload the window (F1 → Developer: Reload Window)';
								vscode.window.showErrorMessage(errorMsg);
								console.error('Sharp is not available. Value:', sharp);
								resolve({ cancelled: true });
								return;
							}

							const { x, y, width, height } = message.cropData;
							
							console.log('Starting crop operation...');
							console.log('Crop area:', { x, y, width, height });
							console.log('Original image path:', imagePath);
							console.log('Workspace folder:', workspaceFolder);
							
							// Create cropped image
							const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0];
							const croppedFileName = `cropped_${timestamp}.png`;
							const evidenceDir = path.resolve(path.join(workspaceFolder, 'test-evidences'));
							
							console.log('Evidence directory:', evidenceDir);
							
							// Ensure directory exists
							if (!fs.existsSync(evidenceDir)) {
								fs.mkdirSync(evidenceDir, { recursive: true });
								console.log('Created evidence directory:', evidenceDir);
							}
							
							const croppedFilePath = path.join(evidenceDir, croppedFileName);
							console.log('Target cropped file path:', croppedFilePath);

							console.log('Calling sharp to crop image...');
							await sharp(imagePath)
								.extract({
									left: Math.round(x),
									top: Math.round(y),
									width: Math.round(width),
									height: Math.round(height)
								})
								.toFile(croppedFilePath);
							
							console.log('Sharp crop completed successfully');

							// Verify the cropped file was created
							if (!fs.existsSync(croppedFilePath)) {
								throw new Error('Cropped file was not created successfully');
							}

							console.log('Cropped image created at:', croppedFilePath);
							console.log('File exists:', fs.existsSync(croppedFilePath));

							// Delete original uncropped image
							try {
								fs.unlinkSync(imagePath);
								console.log('Original image deleted:', imagePath);
							} catch (err) {
								console.error('Failed to delete original image:', err);
							}

							resolved = true; // Mark as resolved
							panel.dispose();
							console.log('Resolving with cropped image data:', { fileName: croppedFileName, filePath: croppedFilePath, cropped: true });
							resolve({ 
								fileName: croppedFileName, 
								filePath: croppedFilePath,
								cropped: true
							});
						} catch (error) {
							console.error('Error during crop operation:', error);
							console.error('Error stack:', error.stack);
							vscode.window.showErrorMessage(`Failed to crop image: ${error.message}`);
							resolved = true; // Mark as resolved
							panel.dispose();
							resolve({ cancelled: true });
						}
						break;

					case 'skip':
						resolved = true; // Mark as resolved
						panel.dispose();
						resolve({ 
							fileName: path.basename(imagePath), 
							filePath: imagePath,
							cropped: false
						});
						break;

					case 'cancel':
						// Delete the original image
						try {
							fs.unlinkSync(imagePath);
						} catch (err) {
							console.error('Failed to delete image:', err);
						}
						resolved = true; // Mark as resolved
						panel.dispose();
						resolve({ cancelled: true });
						break;
				}
			},
			undefined
		);

		// Handle panel disposal
		panel.onDidDispose(() => {
			if (!resolved) { // Only resolve if not already resolved
				console.log('Panel disposed without explicit action');
				resolve({ cancelled: true });
			}
		});
	});
}

function getCropEditorHTML(imageUri) {
	return `<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<title>Crop Screenshot</title>
		<style>
			body {
				margin: 0;
				padding: 20px;
				font-family: var(--vscode-font-family);
				background-color: var(--vscode-editor-background);
				color: var(--vscode-foreground);
				display: flex;
				flex-direction: column;
				align-items: center;
				height: 100vh;
			}
			.header {
				width: 100%;
				max-width: 1200px;
				margin-bottom: 15px;
			}
			h2 {
				margin: 0 0 10px 0;
				color: var(--vscode-editor-foreground);
			}
			.instructions {
				color: var(--vscode-descriptionForeground);
				font-size: 0.9em;
				margin-bottom: 15px;
			}
			.canvas-container {
				position: relative;
				display: inline-block;
				max-width: 100%;
				max-height: calc(100vh - 200px);
				overflow: auto;
				border: 2px solid var(--vscode-panel-border);
				background: #f0f0f0;
			}
			#imageCanvas {
				display: block;
				cursor: crosshair;
			}
			.crop-rect {
				position: absolute;
				border: 2px dashed #00ff00;
				background-color: rgba(0, 255, 0, 0.1);
				pointer-events: none;
			}
			.buttons {
				margin-top: 20px;
				display: flex;
				gap: 10px;
			}
			button {
				padding: 10px 20px;
				font-size: 14px;
				border: none;
				border-radius: 4px;
				cursor: pointer;
				font-family: var(--vscode-font-family);
			}
			.btn-primary {
				background-color: var(--vscode-button-background);
				color: var(--vscode-button-foreground);
			}
			.btn-primary:hover {
				background-color: var(--vscode-button-hoverBackground);
			}
			.btn-secondary {
				background-color: var(--vscode-button-secondaryBackground);
				color: var(--vscode-button-secondaryForeground);
			}
			.btn-secondary:hover {
				background-color: var(--vscode-button-secondaryHoverBackground);
			}
			.btn-danger {
				background-color: #dc3545;
				color: white;
			}
			.btn-danger:hover {
				background-color: #c82333;
			}
			button:disabled {
				opacity: 0.5;
				cursor: not-allowed;
			}
			.crop-info {
				margin-top: 10px;
				font-size: 0.85em;
				color: var(--vscode-descriptionForeground);
			}
		</style>
	</head>
	<body>
		<div class="header">
			<h2>Crop Screenshot</h2>
			<div class="instructions">
				Click and drag on the image to select the area you want to keep.
			</div>
		</div>
		
		<div class="canvas-container" id="canvasContainer">
			<canvas id="imageCanvas"></canvas>
			<div class="crop-rect" id="cropRect" style="display: none;"></div>
		</div>
		
		<div class="crop-info" id="cropInfo"></div>
		
		<div class="buttons">
			<button class="btn-primary" id="cropBtn" disabled>Crop & Save</button>
			<button class="btn-secondary" id="skipBtn">Skip Crop (Use Full Image)</button>
			<button class="btn-danger" id="cancelBtn">Cancel</button>
		</div>

		<script>
			const vscode = acquireVsCodeApi();
			const canvas = document.getElementById('imageCanvas');
			const ctx = canvas.getContext('2d');
			const cropRect = document.getElementById('cropRect');
			const cropInfo = document.getElementById('cropInfo');
			const cropBtn = document.getElementById('cropBtn');
			const skipBtn = document.getElementById('skipBtn');
			const cancelBtn = document.getElementById('cancelBtn');
			
			let img = new Image();
			let isDrawing = false;
			let startX, startY, endX, endY;
			let cropData = null;

			img.onload = function() {
				canvas.width = img.width;
				canvas.height = img.height;
				ctx.drawImage(img, 0, 0);
			};
			img.src = '${imageUri}';

			canvas.addEventListener('mousedown', (e) => {
				isDrawing = true;
				const rect = canvas.getBoundingClientRect();
				startX = e.clientX - rect.left;
				startY = e.clientY - rect.top;
			});

			canvas.addEventListener('mousemove', (e) => {
				if (!isDrawing) return;
				
				const rect = canvas.getBoundingClientRect();
				endX = e.clientX - rect.left;
				endY = e.clientY - rect.top;
				
				// Redraw image
				ctx.clearRect(0, 0, canvas.width, canvas.height);
				ctx.drawImage(img, 0, 0);
				
				// Draw selection rectangle
				const width = endX - startX;
				const height = endY - startY;
				
				ctx.strokeStyle = '#00ff00';
				ctx.lineWidth = 2;
				ctx.setLineDash([5, 5]);
				ctx.strokeRect(startX, startY, width, height);
				
				ctx.fillStyle = 'rgba(0, 255, 0, 0.1)';
				ctx.fillRect(startX, startY, width, height);
				
				// Update info
				cropInfo.textContent = \`Selection: \${Math.abs(width).toFixed(0)} x \${Math.abs(height).toFixed(0)} pixels\`;
			});

			canvas.addEventListener('mouseup', (e) => {
				if (!isDrawing) return;
				isDrawing = false;
				
				const rect = canvas.getBoundingClientRect();
				endX = e.clientX - rect.left;
				endY = e.clientY - rect.top;
				
				// Calculate crop area
				const x = Math.min(startX, endX);
				const y = Math.min(startY, endY);
				const width = Math.abs(endX - startX);
				const height = Math.abs(endY - startY);
				
				if (width > 10 && height > 10) {
					cropData = { x, y, width, height };
					cropBtn.disabled = false;
					cropInfo.textContent = \`Selected area: \${width.toFixed(0)} x \${height.toFixed(0)} pixels\`;
				} else {
					cropBtn.disabled = true;
					cropInfo.textContent = 'Selection too small. Please select a larger area.';
				}
			});

			cropBtn.addEventListener('click', () => {
				if (cropData) {
					vscode.postMessage({
						command: 'crop',
						cropData: cropData
					});
				}
			});

			skipBtn.addEventListener('click', () => {
				vscode.postMessage({ command: 'skip' });
			});

			cancelBtn.addEventListener('click', () => {
				vscode.postMessage({ command: 'cancel' });
			});
		</script>
	</body>
	</html>`;
}

// Screenshot Helper Functions
async function captureScreenshot(workspaceFolder, description = '') {
	try {
		if (!screenshot) {
			throw new Error('Screenshot module not available. Please run: npm install');
		}

		// Create screenshots folder if it doesn't exist
		const screenshotsPath = path.join(workspaceFolder, 'test-evidences');
		if (!fs.existsSync(screenshotsPath)) {
			fs.mkdirSync(screenshotsPath, { recursive: true });
		}

		// Generate filename with timestamp
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0];
		const safeName = description ? description.replace(/[^a-z0-9]/gi, '_').substring(0, 50) + '_' : '';
		const fileName = `${safeName}${timestamp}.png`;
		const filePath = path.join(screenshotsPath, fileName);

		// Capture screenshot
		const img = await screenshot({ format: 'png' });
		fs.writeFileSync(filePath, img);

		return { fileName, filePath };
	} catch (error) {
		throw new Error(`Failed to capture screenshot: ${error.message}`);
	}
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	console.log('Test Documentation extension is now active!');

	// Initialize data manager
	const dataManager = new TestDataManager(context);

	// Initialize tree provider
	const treeProvider = new TestProjectsProvider(dataManager);
	const treeView = vscode.window.createTreeView('testProjectsView', {
		treeDataProvider: treeProvider
	});

	// Command: Create Project
	context.subscriptions.push(
		vscode.commands.registerCommand('test-documentation.createProject', async () => {
			const name = await vscode.window.showInputBox({
				prompt: 'Enter project name',
				placeHolder: 'My Test Project'
			});

			if (name) {
				const description = await vscode.window.showInputBox({
					prompt: 'Enter project description (optional)',
					placeHolder: 'Project description'
				});

				const project = {
					id: Date.now().toString(),
					name: name,
					description: description || '',
					requirements: [],
					createdDate: new Date().toISOString()
				};

				await dataManager.addProject(project);
				treeProvider.refresh();
				vscode.window.showInformationMessage(`Project "${name}" created successfully!`);
			}
		})
	);

	// Command: Delete Project
	context.subscriptions.push(
		vscode.commands.registerCommand('test-documentation.deleteProject', async (item) => {
			if (item && item instanceof ProjectTreeItem) {
				const confirm = await vscode.window.showWarningMessage(
					`Are you sure you want to delete project "${item.project.name}"?`,
					'Yes', 'No'
				);

				if (confirm === 'Yes') {
					await dataManager.deleteProject(item.project.id);
					treeProvider.refresh();
					vscode.window.showInformationMessage(`Project "${item.project.name}" deleted.`);
				}
			}
		})
	);

	// Command: Add Requirement
	context.subscriptions.push(
		vscode.commands.registerCommand('test-documentation.addRequirement', async (item) => {
			if (item && item instanceof ProjectTreeItem) {
				const name = await vscode.window.showInputBox({
					prompt: 'Enter requirement name',
					placeHolder: 'REQ-001: Login functionality'
				});

				if (name) {
					const description = await vscode.window.showInputBox({
						prompt: 'Enter requirement description (optional)',
						placeHolder: 'User should be able to login...'
					});

					const requirement = {
						id: Date.now().toString(),
						name: name,
						description: description || '',
						testCases: [],
						createdDate: new Date().toISOString()
					};

					const project = item.project;
					if (!project.requirements) {
						project.requirements = [];
					}
					project.requirements.push(requirement);

					await dataManager.updateProject(project.id, project);
					treeProvider.refresh();
					vscode.window.showInformationMessage(`Requirement "${name}" added!`);
				}
			}
		})
	);

	// Command: Delete Requirement
	context.subscriptions.push(
		vscode.commands.registerCommand('test-documentation.deleteRequirement', async (item) => {
			if (item && item instanceof RequirementTreeItem) {
				const project = dataManager.getProject(item.projectId);
				
				const confirm = await vscode.window.showWarningMessage(
					`Are you sure you want to delete requirement "${item.requirement.name}"?`,
					'Yes', 'No'
				);

				if (confirm === 'Yes' && project) {
					project.requirements = project.requirements.filter(r => r.id !== item.requirement.id);
					await dataManager.updateProject(project.id, project);
					treeProvider.refresh();
					vscode.window.showInformationMessage(`Requirement deleted.`);
				}
			}
		})
	);

	// Command: Add Test Case
	context.subscriptions.push(
		vscode.commands.registerCommand('test-documentation.addTestCase', async (item) => {
			if (item && item instanceof RequirementTreeItem) {
				const name = await vscode.window.showInputBox({
					prompt: 'Enter test case name',
					placeHolder: 'TC-001: Valid login credentials'
				});

				if (name) {
					const expectedResult = await vscode.window.showInputBox({
						prompt: 'Enter expected result',
						placeHolder: 'User should be logged in successfully'
					});

					if (expectedResult) {
						const testCase = {
							id: Date.now().toString(),
							name: name,
							expectedResult: expectedResult,
							executed: false,
							passed: false,
							executedBy: '',
							executionDate: '',
							observations: '',
							evidences: [],
							createdDate: new Date().toISOString()
						};

						const project = dataManager.getProject(item.projectId);
						const requirement = project.requirements.find(r => r.id === item.requirement.id);
						
						if (!requirement.testCases) {
							requirement.testCases = [];
						}
						requirement.testCases.push(testCase);

						await dataManager.updateProject(project.id, project);
						treeProvider.refresh();
						vscode.window.showInformationMessage(`Test case "${name}" added!`);
					}
				}
			}
		})
	);

	// Command: Delete Test Case
	context.subscriptions.push(
		vscode.commands.registerCommand('test-documentation.deleteTestCase', async (item) => {
			if (item && item instanceof TestCaseTreeItem) {
				const project = dataManager.getProject(item.projectId);
				
				const confirm = await vscode.window.showWarningMessage(
					`Are you sure you want to delete test case "${item.testCase.name}"?`,
					'Yes', 'No'
				);

				if (confirm === 'Yes' && project) {
					const requirement = project.requirements.find(r => r.id === item.requirementId);
					requirement.testCases = requirement.testCases.filter(tc => tc.id !== item.testCase.id);
					await dataManager.updateProject(project.id, project);
					treeProvider.refresh();
					vscode.window.showInformationMessage(`Test case deleted.`);
				}
			}
		})
	);

	// Command: Execute Test
	context.subscriptions.push(
		vscode.commands.registerCommand('test-documentation.executeTest', async (item) => {
			if (item && item instanceof TestCaseTreeItem) {
				const executedBy = await vscode.window.showInputBox({
					prompt: 'Enter your name',
					placeHolder: 'John Doe'
				});

				if (executedBy) {
					const passed = await vscode.window.showQuickPick(['Passed', 'Failed'], {
						placeHolder: 'Did the test pass or fail?'
					});

					if (passed) {
						const observations = await vscode.window.showInputBox({
							prompt: 'Enter observations (optional)',
							placeHolder: 'Additional notes...'
						});

						const project = dataManager.getProject(item.projectId);
						const requirement = project.requirements.find(r => r.id === item.requirementId);
						const testCase = requirement.testCases.find(tc => tc.id === item.testCase.id);

						testCase.executed = true;
						testCase.passed = passed === 'Passed';
						testCase.executedBy = executedBy;
						testCase.executionDate = new Date().toLocaleString();
						testCase.observations = observations || '';

						await dataManager.updateProject(project.id, project);
						treeProvider.refresh();
						vscode.window.showInformationMessage(`Test execution recorded!`);
					}
				}
			}
		})
	);

	// Command: Add Evidence
	context.subscriptions.push(
		vscode.commands.registerCommand('test-documentation.addEvidence', async (item) => {
			if (item && item instanceof TestCaseTreeItem) {
				// Ask user to choose method
				const method = await vscode.window.showQuickPick([
					{ label: '📸 Capture Screenshot', value: 'capture' },
					{ label: '📁 Select Existing Files', value: 'select' }
				], {
					placeHolder: 'How would you like to add evidence?'
				});

				if (!method) {
					return;
				}

				const project = dataManager.getProject(item.projectId);
				const requirement = project.requirements.find(r => r.id === item.requirementId);
				const testCase = requirement.testCases.find(tc => tc.id === item.testCase.id);

				if (method.value === 'capture') {
					// Capture screenshot option
					const captureOption = await vscode.window.showQuickPick([
						{ label: '🖥️ Capture Immediate Screenshot', value: 'immediate' },
						{ label: '🪟 Capture with 3s Delay (switch to window)', value: 'delayed' }
					], {
						placeHolder: 'What would you like to capture?'
					});

					if (!captureOption) {
						return;
					}

					// Get workspace folder
					const workspaceFolders = vscode.workspace.workspaceFolders;
					if (!workspaceFolders || workspaceFolders.length === 0) {
						vscode.window.showErrorMessage('Please open a workspace folder first.');
						return;
					}

					const workspaceFolder = workspaceFolders[0].uri.fsPath;

					try {
						let description = '';
						
						if (captureOption.value === 'delayed') {
							// Ask for window description
							description = await vscode.window.showInputBox({
								prompt: 'Enter a description for this screenshot (optional)',
								placeHolder: 'e.g., Login Screen, Error Dialog'
							}) || 'screenshot';
							
							// Show countdown
							vscode.window.showInformationMessage('Switch to the window you want to capture. Screenshot in 3 seconds...');
							await new Promise(resolve => setTimeout(resolve, 3000));
						}
						
						// Capture screenshot
						const captureResult = await vscode.window.withProgress({
							location: vscode.ProgressLocation.Notification,
							title: "Capturing screenshot...",
							cancellable: false
						}, async () => {
							return await captureScreenshot(workspaceFolder, description);
						});

						// Ask if user wants to crop
						const cropChoice = await vscode.window.showQuickPick([
							{ label: '✂️ Crop Image', value: 'crop' },
							{ label: '✓ Use Full Image', value: 'full' }
						], {
							placeHolder: 'Would you like to crop the screenshot?'
						});

						let finalResult = captureResult;

						if (cropChoice && cropChoice.value === 'crop') {
							// Open crop editor
							console.log('Opening crop editor for:', captureResult.filePath);
							const cropResult = await openCropEditor(captureResult.filePath, workspaceFolder);
							console.log('Crop editor returned result:', cropResult);
							
							if (cropResult.cancelled) {
								vscode.window.showInformationMessage('Screenshot cancelled.');
								return;
							}
							
							finalResult = cropResult;
						}

						const evidence = {
							id: Date.now().toString() + Math.random(),
							fileName: finalResult.fileName,
							filePath: finalResult.filePath,
							addedDate: new Date().toLocaleString(),
							captureType: captureOption.value === 'delayed' ? 'Delayed Capture' : 'Immediate Capture',
							description: description,
							cropped: finalResult.cropped || false
						};

						console.log('Adding evidence:', evidence);
						console.log('File exists at time of adding:', fs.existsSync(evidence.filePath));

						if (!testCase.evidences) {
							testCase.evidences = [];
						}
						testCase.evidences.push(evidence);

						await dataManager.updateProject(project.id, project);
						treeProvider.refresh();
						
						const cropMsg = finalResult.cropped ? ' (cropped)' : '';
						vscode.window.showInformationMessage(`Screenshot captured successfully${cropMsg}!`);
					} catch (error) {
						vscode.window.showErrorMessage(`Failed to capture screenshot: ${error.message}`);
					}
				} else {
					// Select existing files
					const fileUris = await vscode.window.showOpenDialog({
						canSelectMany: true,
						filters: { 'Images': ['png', 'jpg', 'jpeg', 'gif', 'bmp'] },
						openLabel: 'Select Screenshot(s)'
					});

					if (fileUris && fileUris.length > 0) {
						for (const fileUri of fileUris) {
							const evidence = {
								id: Date.now().toString() + Math.random(),
								fileName: path.basename(fileUri.fsPath),
								filePath: fileUri.fsPath,
								addedDate: new Date().toLocaleString(),
								captureType: 'Imported File'
							};

							if (!testCase.evidences) {
								testCase.evidences = [];
							}
							testCase.evidences.push(evidence);
						}

						await dataManager.updateProject(project.id, project);
						treeProvider.refresh();
						vscode.window.showInformationMessage(`${fileUris.length} evidence(s) added!`);
					}
				}
			}
		})
	);

	// Command: View Test Details
	context.subscriptions.push(
		vscode.commands.registerCommand('test-documentation.viewTestDetails', async (item) => {
			if (item && item instanceof TestCaseTreeItem) {
				const testCase = item.testCase;
				const projectId = item.projectId;
				const requirementId = item.requirementId;

				// Collect all unique directories from evidence file paths
				const resourceRoots = [];
				if (testCase.evidences && testCase.evidences.length > 0) {
					const uniqueDirs = new Set();
					testCase.evidences.forEach(evidence => {
						if (evidence.filePath) {
							uniqueDirs.add(path.dirname(evidence.filePath));
						}
					});
					uniqueDirs.forEach(dir => {
						resourceRoots.push(vscode.Uri.file(dir));
					});
				}
				
				// Always add workspace folder if available
				const workspaceFolders = vscode.workspace.workspaceFolders;
				if (workspaceFolders && workspaceFolders.length > 0) {
					resourceRoots.push(workspaceFolders[0].uri);
				}

				const panel = vscode.window.createWebviewPanel(
					'testDetails',
					`Test Case: ${testCase.name}`,
					vscode.ViewColumn.One,
					{ 
						enableScripts: true,
						localResourceRoots: resourceRoots.length > 0 ? resourceRoots : undefined
					}
				);

				// Function to refresh webview content
				const refreshWebview = () => {
					const projects = dataManager.getProjects();
					const project = projects.find(p => p.id === projectId);
					if (project && project.requirements) {
						const requirement = project.requirements.find(r => r.id === requirementId);
						if (requirement && requirement.testCases) {
							const updatedTestCase = requirement.testCases.find(tc => tc.id === testCase.id);
							if (updatedTestCase) {
								panel.webview.html = getWebviewContent(updatedTestCase, panel.webview);
							}
						}
					}
				};

				// Handle messages from webview
				panel.webview.onDidReceiveMessage(
					async message => {
						if (message.command === 'removeEvidence') {
							await vscode.commands.executeCommand('test-documentation.removeEvidence', {
								projectId: projectId,
								requirementId: requirementId,
								testCaseId: testCase.id,
								evidenceId: message.evidenceId,
								refreshWebview: refreshWebview
							});
						}
					},
					undefined,
					context.subscriptions
				);

				panel.webview.html = getWebviewContent(testCase, panel.webview);
			}
		})
	);

	// Command: Refresh View
	context.subscriptions.push(
		vscode.commands.registerCommand('test-documentation.refreshView', () => {
			treeProvider.refresh();
		})
	);

	// Command: Remove Evidence
	context.subscriptions.push(
		vscode.commands.registerCommand('test-documentation.removeEvidence', async (args) => {
			try {
				console.log('Remove evidence called with args:', args);
				
				const { projectId, requirementId, testCaseId, evidenceId } = args;
				
				const projects = dataManager.getProjects();
				const project = projects.find(p => p.id === projectId);
				if (!project) {
					vscode.window.showErrorMessage('Project not found.');
					return;
				}

				if (!project.requirements) {
					vscode.window.showErrorMessage('No requirements found.');
					return;
				}

				const requirement = project.requirements.find(r => r.id === requirementId);
				if (!requirement) {
					vscode.window.showErrorMessage('Requirement not found.');
					return;
				}

				if (!requirement.testCases) {
					vscode.window.showErrorMessage('No test cases found.');
					return;
				}

				const testCase = requirement.testCases.find(tc => tc.id === testCaseId);
				if (!testCase) {
					vscode.window.showErrorMessage('Test case not found.');
					return;
				}

				if (!testCase.evidences) {
					vscode.window.showErrorMessage('No evidences found.');
					return;
				}

				const evidenceIndex = testCase.evidences.findIndex(e => e.id === evidenceId);
				if (evidenceIndex === -1 || evidenceIndex === undefined) {
					vscode.window.showErrorMessage('Evidence not found.');
					return;
				}

				const evidence = testCase.evidences[evidenceIndex];
				
				// Confirm deletion
				const confirm = await vscode.window.showWarningMessage(
					`Remove evidence "${evidence.fileName}"?`,
					{ modal: true },
					'Delete File & Remove',
					'Remove Only'
				);

				if (!confirm) {
					return;
				}

				// Delete physical file if requested and it's in the workspace
				if (confirm === 'Delete File & Remove') {
					try {
						if (fs.existsSync(evidence.filePath)) {
							fs.unlinkSync(evidence.filePath);
							console.log('Deleted file:', evidence.filePath);
						}
					} catch (err) {
						console.error('Failed to delete file:', err);
						vscode.window.showWarningMessage(`File deleted from evidence list, but failed to delete physical file: ${err.message}`);
					}
				}

				// Remove from array
				testCase.evidences.splice(evidenceIndex, 1);
				
				await dataManager.updateProject(project.id, project);
				treeProvider.refresh();
				
				vscode.window.showInformationMessage('Evidence removed successfully.');
				
				// Refresh the webview if it's open
				if (args.refreshWebview) {
					args.refreshWebview();
				}
			} catch (error) {
				console.error('Error removing evidence:', error);
				vscode.window.showErrorMessage(`Failed to remove evidence: ${error.message}`);
			}
		})
	);

	// Command: View Requirement Report
	context.subscriptions.push(
		vscode.commands.registerCommand('test-documentation.viewRequirementReport', async (item) => {
			if (item && item instanceof RequirementTreeItem) {
				const requirement = item.requirement;
				const projectId = item.projectId;

				// Get the project
				const projects = dataManager.getProjects();
				const project = projects.find(p => p.id === projectId);
				if (!project) {
					vscode.window.showErrorMessage('Project not found.');
					return;
				}

				// Collect all unique directories from evidence file paths
				const resourceRoots = [];
				const testCases = requirement.testCases || [];
				const uniqueDirs = new Set();
				testCases.forEach(testCase => {
					if (testCase.evidences) {
						testCase.evidences.forEach(evidence => {
							if (evidence.filePath) {
								uniqueDirs.add(path.dirname(evidence.filePath));
							}
						});
					}
				});
				uniqueDirs.forEach(dir => {
					resourceRoots.push(vscode.Uri.file(dir));
				});

				// Always add workspace folder if available
				const workspaceFolders = vscode.workspace.workspaceFolders;
				if (workspaceFolders && workspaceFolders.length > 0) {
					resourceRoots.push(workspaceFolders[0].uri);
				}

				const panel = vscode.window.createWebviewPanel(
					'requirementReport',
					`Requirement Report: ${requirement.name}`,
					vscode.ViewColumn.One,
					{ 
						enableScripts: true,
						localResourceRoots: resourceRoots.length > 0 ? resourceRoots : undefined
					}
				);

				panel.webview.html = getRequirementReportContent(requirement, project, panel.webview);
			}
		})
	);

	// Command: View Project Report
	context.subscriptions.push(
		vscode.commands.registerCommand('test-documentation.viewProjectReport', async (item) => {
			if (item && item instanceof ProjectTreeItem) {
				const project = item.project;

				// Collect all unique directories from evidence file paths
				const resourceRoots = [];
				const uniqueDirs = new Set();
				const requirements = project.requirements || [];
				requirements.forEach(requirement => {
					const testCases = requirement.testCases || [];
					testCases.forEach(testCase => {
						if (testCase.evidences) {
							testCase.evidences.forEach(evidence => {
								if (evidence.filePath) {
									uniqueDirs.add(path.dirname(evidence.filePath));
								}
							});
						}
					});
				});
				uniqueDirs.forEach(dir => {
					resourceRoots.push(vscode.Uri.file(dir));
				});

				// Always add workspace folder if available
				const workspaceFolders = vscode.workspace.workspaceFolders;
				if (workspaceFolders && workspaceFolders.length > 0) {
					resourceRoots.push(workspaceFolders[0].uri);
				}

				const panel = vscode.window.createWebviewPanel(
					'projectReport',
					`Project Report: ${project.name}`,
					vscode.ViewColumn.One,
					{ 
						enableScripts: true,
						localResourceRoots: resourceRoots.length > 0 ? resourceRoots : undefined
					}
				);

				panel.webview.html = getProjectReportContent(project, panel.webview);
			}
		})
	);

	context.subscriptions.push(treeView);
}

function getWebviewContent(testCase, webview) {
	let evidencesHtml = '';
	if (testCase.evidences && testCase.evidences.length > 0) {
		evidencesHtml = '<h2>Evidences</h2><div class="evidences">';
		testCase.evidences.forEach((evidence, index) => {
			const captureInfo = evidence.captureType ? `<p><strong>Type:</strong> ${evidence.captureType}</p>` : '';
			const descriptionInfo = evidence.description ? `<p><strong>Description:</strong> ${evidence.description}</p>` : '';
			const windowInfo = evidence.windowTitle ? `<p><strong>Window:</strong> ${evidence.windowTitle}</p>` : '';
			const croppedInfo = evidence.cropped ? `<p><strong>Cropped:</strong> Yes ✂️</p>` : '';
			
			// Convert file path to webview URI
			let imageHtml = '';
			console.log('Processing evidence:', evidence.fileName, 'Path:', evidence.filePath, 'Exists:', fs.existsSync(evidence.filePath));
			if (evidence.filePath && fs.existsSync(evidence.filePath)) {
				try {
					const imageUri = webview.asWebviewUri(vscode.Uri.file(evidence.filePath));
					console.log('Webview URI created:', imageUri.toString());
					imageHtml = `
						<div class="image-container">
							<img src="${imageUri}" alt="${evidence.fileName}" class="evidence-image" onclick="this.classList.toggle('enlarged')" onerror="console.error('Failed to load image: ${evidence.fileName}')">
							<p class="image-hint">Click image to enlarge</p>
						</div>
					`;
				} catch (error) {
					console.error('Error creating webview URI:', error);
					imageHtml = `<p class="error">Failed to load image: ${error.message}</p>`;
				}
			} else {
				console.error('Image file not found or path is invalid');
				imageHtml = `<p class="error">Image file not found: ${evidence.filePath}</p>`;
			}
			
			evidencesHtml += `
				<div class="evidence-item">
					<div class="evidence-header">
						<h3>${index + 1}. ${evidence.fileName}</h3>
						<button class="remove-btn" onclick="removeEvidence('${evidence.id}')" title="Remove Evidence">🗑️ Remove</button>
					</div>
					${captureInfo}
					${descriptionInfo}
					${croppedInfo}
					${windowInfo}
					<p><strong>Path:</strong> ${evidence.filePath}</p>
					<p><strong>Added:</strong> ${evidence.addedDate}</p>
					${imageHtml}
				</div>
			`;
		});
		evidencesHtml += '</div>';
	}

	const statusBadge = testCase.executed 
		? (testCase.passed 
			? '<span class="badge badge-success">✓ Passed</span>' 
			: '<span class="badge badge-failed">✗ Failed</span>')
		: '<span class="badge badge-pending">Not Executed</span>';

	return `<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<title>Test Case Details</title>
		<style>
			body {
				font-family: var(--vscode-font-family);
				padding: 20px;
				color: var(--vscode-foreground);
				background-color: var(--vscode-editor-background);
			}
			h1 {
				color: var(--vscode-editor-foreground);
				border-bottom: 2px solid var(--vscode-panel-border);
				padding-bottom: 10px;
			}
			h2 {
				color: var(--vscode-editor-foreground);
				margin-top: 30px;
			}
			.info-section {
				background-color: var(--vscode-editor-inactiveSelectionBackground);
				padding: 15px;
				border-radius: 5px;
				margin: 10px 0;
			}
			.info-row {
				margin: 10px 0;
			}
			.label {
				font-weight: bold;
				color: var(--vscode-textPreformat-foreground);
			}
			.badge {
				display: inline-block;
				padding: 5px 15px;
				border-radius: 12px;
				font-weight: bold;
				margin: 10px 0;
			}
			.badge-success {
				background-color: #28a745;
				color: white;
			}
			.badge-failed {
				background-color: #dc3545;
				color: white;
			}
			.badge-pending {
				background-color: #6c757d;
				color: white;
			}
			.evidences {
				margin-top: 15px;
			}
			.evidence-item {
				background-color: var(--vscode-editor-inactiveSelectionBackground);
				padding: 15px;
				margin: 10px 0;
				border-radius: 5px;
				border-left: 4px solid var(--vscode-textLink-foreground);
			}
			.evidence-header {
				display: flex;
				justify-content: space-between;
				align-items: center;
				margin-bottom: 10px;
			}
			.evidence-item h3 {
				margin-top: 0;
				margin-bottom: 0;
				color: var(--vscode-textLink-foreground);
			}
			.remove-btn {
				background-color: var(--vscode-button-secondaryBackground);
				color: var(--vscode-button-secondaryForeground);
				border: none;
				padding: 6px 12px;
				border-radius: 4px;
				cursor: pointer;
				font-size: 0.9em;
				transition: background-color 0.2s;
			}
			.remove-btn:hover {
				background-color: #dc3545;
				color: white;
			}
			.image-container {
				margin-top: 15px;
				text-align: center;
			}
			.evidence-image {
				max-width: 100%;
				height: auto;
				border: 1px solid var(--vscode-panel-border);
				border-radius: 4px;
				cursor: pointer;
				transition: all 0.3s ease;
				box-shadow: 0 2px 8px rgba(0,0,0,0.1);
			}
			.evidence-image:hover {
				box-shadow: 0 4px 16px rgba(0,0,0,0.2);
			}
			.evidence-image.enlarged {
				max-width: none;
				width: auto;
				max-height: 90vh;
				position: fixed;
				top: 50%;
				left: 50%;
				transform: translate(-50%, -50%);
				z-index: 1000;
				box-shadow: 0 8px 32px rgba(0,0,0,0.3);
			}
			.image-hint {
				font-size: 0.85em;
				color: var(--vscode-descriptionForeground);
				font-style: italic;
				margin-top: 5px;
			}
			.error {
				color: var(--vscode-errorForeground);
				font-style: italic;
			}
		</style>
	</head>
	<body>
		<h1>${testCase.name}</h1>
		
		<div class="info-section">
			<div class="info-row">
				<span class="label">Status:</span> ${statusBadge}
			</div>
			<div class="info-row">
				<span class="label">Expected Result:</span>
				<p>${testCase.expectedResult}</p>
			</div>
			${testCase.executed ? `
			<div class="info-row">
				<span class="label">Executed By:</span> ${testCase.executedBy}
			</div>
			<div class="info-row">
				<span class="label">Execution Date:</span> ${testCase.executionDate}
			</div>
			${testCase.observations ? `
			<div class="info-row">
				<span class="label">Observations:</span>
				<p>${testCase.observations}</p>
			</div>
			` : ''}
			` : ''}
		</div>

		${evidencesHtml}
		
		<script>
			const vscode = acquireVsCodeApi();
			
			function removeEvidence(evidenceId) {
				vscode.postMessage({
					command: 'removeEvidence',
					evidenceId: evidenceId
				});
			}
		</script>
	</body>
	</html>`;
}

function getRequirementReportContent(requirement, project, webview) {
	const testCasesList = requirement.testCases || [];
	const totalTests = testCasesList.length;
	const executedTests = testCasesList.filter(tc => tc.executed).length;
	const passedTests = testCasesList.filter(tc => tc.executed && tc.passed).length;
	const failedTests = testCasesList.filter(tc => tc.executed && !tc.passed).length;
	const notExecutedTests = totalTests - executedTests;

	let testsHtml = '';
	if (testCasesList.length > 0) {
		testCasesList.forEach((testCase, index) => {
			const statusBadge = testCase.executed 
				? (testCase.passed 
					? '<span class="badge badge-success">✓ Passed</span>' 
					: '<span class="badge badge-failed">✗ Failed</span>')
				: '<span class="badge badge-pending">○ Not Executed</span>';

			const executionInfo = testCase.executed ? `
				<p><strong>Executed By:</strong> ${testCase.executedBy}</p>
				<p><strong>Execution Date:</strong> ${testCase.executionDate}</p>
				${testCase.observations ? `<p><strong>Observations:</strong> ${testCase.observations}</p>` : ''}
			` : '';

			// Build evidence HTML with images
			let evidenceHtml = '';
			if (testCase.evidences && testCase.evidences.length > 0) {
				evidenceHtml = '<div class="evidences-section"><h4>📎 Evidences</h4>';
				testCase.evidences.forEach((evidence, evidenceIndex) => {
					let imageHtml = '';
					if (evidence.filePath && fs.existsSync(evidence.filePath)) {
						try {
							const imageUri = webview.asWebviewUri(vscode.Uri.file(evidence.filePath));
							imageHtml = `
								<div class="evidence-image-container">
									<img src="${imageUri}" alt="${evidence.fileName}" class="evidence-thumbnail" onclick="this.classList.toggle('enlarged')">
									<p class="image-caption">${evidence.fileName}</p>
								</div>
							`;
						} catch (error) {
							imageHtml = `<p class="error-text">Failed to load image</p>`;
						}
					}

					const croppedBadge = evidence.cropped ? '<span class="cropped-badge">✂️ Cropped</span>' : '';

					evidenceHtml += `
						<div class="evidence-item-small">
							<strong>${evidenceIndex + 1}. ${evidence.fileName}</strong> ${croppedBadge}
							${evidence.description ? `<p class="evidence-desc">${evidence.description}</p>` : ''}
							${imageHtml}
						</div>
					`;
				});
				evidenceHtml += '</div>';
			}

			testsHtml += `
				<div class="test-case-item">
					<h3>${index + 1}. ${testCase.name}</h3>
					<div class="status-line">${statusBadge}</div>
					<p><strong>Expected Result:</strong> ${testCase.expectedResult}</p>
					${executionInfo}
					${evidenceHtml}
				</div>
			`;
		});
	} else {
		testsHtml = '<p class="empty-state">No test cases defined for this requirement.</p>';
	}

	return `<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<title>Requirement Report</title>
		<style>
			body {
				font-family: var(--vscode-font-family);
				padding: 20px;
				color: var(--vscode-foreground);
				background-color: var(--vscode-editor-background);
			}
			h1 {
				color: var(--vscode-editor-foreground);
				border-bottom: 3px solid var(--vscode-panel-border);
				padding-bottom: 15px;
				margin-bottom: 20px;
			}
			h2 {
				color: var(--vscode-editor-foreground);
				margin-top: 30px;
				margin-bottom: 15px;
			}
			.report-header {
				background: linear-gradient(135deg, var(--vscode-editor-inactiveSelectionBackground) 0%, var(--vscode-editor-selectionBackground) 100%);
				padding: 20px;
				border-radius: 8px;
				margin-bottom: 30px;
			}
			.project-info {
				font-size: 0.95em;
				color: var(--vscode-descriptionForeground);
				margin-bottom: 10px;
			}
			.stats-grid {
				display: grid;
				grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
				gap: 15px;
				margin: 20px 0;
			}
			.stat-card {
				background-color: var(--vscode-editor-inactiveSelectionBackground);
				padding: 15px;
				border-radius: 6px;
				text-align: center;
				border-left: 4px solid var(--vscode-textLink-foreground);
			}
			.stat-number {
				font-size: 2em;
				font-weight: bold;
				color: var(--vscode-textLink-foreground);
				display: block;
			}
			.stat-label {
				font-size: 0.9em;
				color: var(--vscode-descriptionForeground);
				margin-top: 5px;
			}
			.test-case-item {
				background-color: var(--vscode-editor-inactiveSelectionBackground);
				padding: 20px;
				margin: 15px 0;
				border-radius: 6px;
				border-left: 4px solid var(--vscode-panel-border);
			}
			.test-case-item h3 {
				margin-top: 0;
				color: var(--vscode-textLink-foreground);
			}
			.status-line {
				margin: 10px 0;
			}
			.badge {
				display: inline-block;
				padding: 5px 15px;
				border-radius: 12px;
				font-weight: bold;
				font-size: 0.9em;
			}
			.badge-success {
				background-color: #28a745;
				color: white;
			}
			.badge-failed {
				background-color: #dc3545;
				color: white;
			}
			.badge-pending {
				background-color: #6c757d;
				color: white;
			}
			.empty-state {
				text-align: center;
				padding: 40px;
				color: var(--vscode-descriptionForeground);
				font-style: italic;
			}
			p {
				margin: 8px 0;
			}
			.evidences-section {
				margin-top: 15px;
				padding-top: 15px;
				border-top: 1px solid var(--vscode-panel-border);
			}
			.evidences-section h4 {
				margin: 0 0 10px 0;
				color: var(--vscode-textLink-foreground);
				font-size: 1em;
			}
			.evidence-item-small {
				margin: 10px 0;
				padding: 10px;
				background-color: var(--vscode-editor-background);
				border-radius: 4px;
			}
			.evidence-desc {
				font-size: 0.9em;
				color: var(--vscode-descriptionForeground);
				margin: 5px 0;
			}
			.evidence-image-container {
				margin: 10px 0;
				text-align: center;
			}
			.evidence-thumbnail {
				max-width: 100%;
				max-height: 300px;
				height: auto;
				border: 1px solid var(--vscode-panel-border);
				border-radius: 4px;
				cursor: pointer;
				transition: all 0.3s ease;
				box-shadow: 0 2px 8px rgba(0,0,0,0.1);
			}
			.evidence-thumbnail:hover {
				box-shadow: 0 4px 16px rgba(0,0,0,0.2);
				transform: scale(1.02);
			}
			.evidence-thumbnail.enlarged {
				max-width: none;
				max-height: 90vh;
				width: auto;
				position: fixed;
				top: 50%;
				left: 50%;
				transform: translate(-50%, -50%);
				z-index: 1000;
				box-shadow: 0 8px 32px rgba(0,0,0,0.5);
			}
			.image-caption {
				font-size: 0.85em;
				color: var(--vscode-descriptionForeground);
				margin: 5px 0;
				font-style: italic;
			}
			.cropped-badge {
				display: inline-block;
				padding: 2px 6px;
				background-color: #ffc107;
				color: #000;
				border-radius: 3px;
				font-size: 0.8em;
				margin-left: 5px;
			}
			.error-text {
				color: var(--vscode-errorForeground);
				font-style: italic;
				font-size: 0.9em;
			}
		</style>
	</head>
	<body>
		<div class="report-header">
			<h1>📋 Requirement Report</h1>
			<div class="project-info">
				<strong>Project:</strong> ${project.name}
			</div>
			<div class="project-info">
				<strong>Requirement:</strong> ${requirement.name}
			</div>
		</div>

		<h2>📊 Summary Statistics</h2>
		<div class="stats-grid">
			<div class="stat-card">
				<span class="stat-number">${totalTests}</span>
				<div class="stat-label">Total Tests</div>
			</div>
			<div class="stat-card" style="border-left-color: #28a745;">
				<span class="stat-number" style="color: #28a745;">${passedTests}</span>
				<div class="stat-label">Passed</div>
			</div>
			<div class="stat-card" style="border-left-color: #dc3545;">
				<span class="stat-number" style="color: #dc3545;">${failedTests}</span>
				<div class="stat-label">Failed</div>
			</div>
			<div class="stat-card" style="border-left-color: #6c757d;">
				<span class="stat-number" style="color: #6c757d;">${notExecutedTests}</span>
				<div class="stat-label">Not Executed</div>
			</div>
		</div>

		<h2>🧪 Test Cases</h2>
		${testsHtml}
	</body>
	</html>`;
}

function getProjectReportContent(project, webview) {
	const requirementsList = project.requirements || [];
	const totalRequirements = requirementsList.length;
	
	let totalTests = 0;
	let passedTests = 0;
	let failedTests = 0;
	let notExecutedTests = 0;

	requirementsList.forEach(req => {
		const tests = req.testCases || [];
		totalTests += tests.length;
		passedTests += tests.filter(tc => tc.executed && tc.passed).length;
		failedTests += tests.filter(tc => tc.executed && !tc.passed).length;
		notExecutedTests += tests.filter(tc => !tc.executed).length;
	});

	let requirementsHtml = '';
	if (requirementsList.length > 0) {
		requirementsList.forEach((requirement, reqIndex) => {
			const testCases = requirement.testCases || [];
			const reqTotalTests = testCases.length;
			const reqPassedTests = testCases.filter(tc => tc.executed && tc.passed).length;
			const reqFailedTests = testCases.filter(tc => tc.executed && !tc.passed).length;
			const reqNotExecuted = testCases.filter(tc => !tc.executed).length;

			// Calculate requirement status
			let reqStatusBadge = '<span class="badge badge-pending">○ Not Executed</span>';
			if (reqTotalTests > 0) {
				if (reqPassedTests === reqTotalTests) {
					reqStatusBadge = '<span class="badge badge-success">✓ All Passed</span>';
				} else if (reqFailedTests > 0) {
					reqStatusBadge = '<span class="badge badge-failed">✗ Has Failures</span>';
				} else if (reqPassedTests > 0) {
					reqStatusBadge = '<span class="badge badge-partial">◐ Partial</span>';
				}
			}

			let testsHtml = '';
			if (testCases.length > 0) {
				testCases.forEach((testCase, testIndex) => {
					const statusBadge = testCase.executed 
						? (testCase.passed 
							? '<span class="badge badge-success">✓ Passed</span>' 
							: '<span class="badge badge-failed">✗ Failed</span>')
						: '<span class="badge badge-pending">○ Not Executed</span>';

					// Build evidence HTML with images
					let evidenceHtml = '';
					if (testCase.evidences && testCase.evidences.length > 0) {
						evidenceHtml = '<div class="evidences-section-mini">';
						testCase.evidences.forEach((evidence, evidenceIndex) => {
							let imageHtml = '';
							if (evidence.filePath && fs.existsSync(evidence.filePath)) {
								try {
									const imageUri = webview.asWebviewUri(vscode.Uri.file(evidence.filePath));
									imageHtml = `
										<div class="evidence-thumb-container">
											<img src="${imageUri}" alt="${evidence.fileName}" class="evidence-thumb" onclick="this.classList.toggle('enlarged')" title="Click to enlarge">
											<span class="evidence-thumb-caption">${evidenceIndex + 1}. ${evidence.fileName}</span>
										</div>
									`;
								} catch (error) {
									imageHtml = `<span class="error-mini">Error loading image</span>`;
								}
							}

							evidenceHtml += imageHtml;
						});
						evidenceHtml += '</div>';
					}

					testsHtml += `
						<div class="test-item">
							<div class="test-header">
								<span class="test-name">${testIndex + 1}. ${testCase.name}</span>
								${statusBadge}
							</div>
							<div class="test-details">
								<p><strong>Expected Result:</strong> ${testCase.expectedResult}</p>
								${testCase.executed ? `<p><strong>Executed By:</strong> ${testCase.executedBy} on ${testCase.executionDate}</p>` : ''}
								${evidenceHtml}
							</div>
						</div>
					`;
				});
			} else {
				testsHtml = '<p class="no-tests">No test cases defined.</p>';
			}

			requirementsHtml += `
				<div class="requirement-section">
					<div class="requirement-header">
						<h3>${reqIndex + 1}. ${requirement.name}</h3>
						${reqStatusBadge}
					</div>
					<div class="requirement-stats">
						<span class="stat-item">Total: ${reqTotalTests}</span>
						<span class="stat-item stat-success">Passed: ${reqPassedTests}</span>
						<span class="stat-item stat-failed">Failed: ${reqFailedTests}</span>
						<span class="stat-item stat-pending">Not Executed: ${reqNotExecuted}</span>
					</div>
					<div class="tests-list">
						${testsHtml}
					</div>
				</div>
			`;
		});
	} else {
		requirementsHtml = '<p class="empty-state">No requirements defined for this project.</p>';
	}

	return `<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<title>Project Report</title>
		<style>
			body {
				font-family: var(--vscode-font-family);
				padding: 20px;
				color: var(--vscode-foreground);
				background-color: var(--vscode-editor-background);
			}
			h1 {
				color: var(--vscode-editor-foreground);
				border-bottom: 3px solid var(--vscode-panel-border);
				padding-bottom: 15px;
				margin-bottom: 20px;
			}
			h2 {
				color: var(--vscode-editor-foreground);
				margin-top: 30px;
				margin-bottom: 20px;
			}
			h3 {
				margin: 0;
				color: var(--vscode-textLink-foreground);
			}
			.report-header {
				background: linear-gradient(135deg, var(--vscode-editor-inactiveSelectionBackground) 0%, var(--vscode-editor-selectionBackground) 100%);
				padding: 25px;
				border-radius: 8px;
				margin-bottom: 30px;
			}
			.stats-grid {
				display: grid;
				grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
				gap: 15px;
				margin: 20px 0;
			}
			.stat-card {
				background-color: var(--vscode-editor-inactiveSelectionBackground);
				padding: 20px;
				border-radius: 6px;
				text-align: center;
				border-left: 4px solid var(--vscode-textLink-foreground);
			}
			.stat-number {
				font-size: 2.5em;
				font-weight: bold;
				color: var(--vscode-textLink-foreground);
				display: block;
			}
			.stat-label {
				font-size: 0.9em;
				color: var(--vscode-descriptionForeground);
				margin-top: 8px;
			}
			.requirement-section {
				background-color: var(--vscode-editor-inactiveSelectionBackground);
				padding: 20px;
				margin: 20px 0;
				border-radius: 8px;
				border-left: 4px solid var(--vscode-textLink-foreground);
			}
			.requirement-header {
				display: flex;
				justify-content: space-between;
				align-items: center;
				margin-bottom: 15px;
				padding-bottom: 10px;
				border-bottom: 1px solid var(--vscode-panel-border);
			}
			.requirement-stats {
				display: flex;
				gap: 20px;
				margin-bottom: 15px;
				font-size: 0.9em;
			}
			.stat-item {
				padding: 5px 10px;
				background-color: var(--vscode-editor-background);
				border-radius: 4px;
			}
			.stat-success {
				color: #28a745;
			}
			.stat-failed {
				color: #dc3545;
			}
			.stat-pending {
				color: #6c757d;
			}
			.tests-list {
				margin-top: 15px;
			}
			.test-item {
				background-color: var(--vscode-editor-background);
				padding: 15px;
				margin: 10px 0;
				border-radius: 4px;
				border-left: 3px solid var(--vscode-panel-border);
			}
			.test-header {
				display: flex;
				justify-content: space-between;
				align-items: center;
				margin-bottom: 10px;
			}
			.test-name {
				font-weight: 600;
				color: var(--vscode-editor-foreground);
			}
			.test-details {
				font-size: 0.9em;
			}
			.test-details p {
				margin: 5px 0;
			}
			.badge {
				display: inline-block;
				padding: 4px 12px;
				border-radius: 10px;
				font-weight: bold;
				font-size: 0.85em;
			}
			.badge-success {
				background-color: #28a745;
				color: white;
			}
			.badge-failed {
				background-color: #dc3545;
				color: white;
			}
			.badge-pending {
				background-color: #6c757d;
				color: white;
			}
			.badge-partial {
				background-color: #ffc107;
				color: #000;
			}
			.empty-state, .no-tests {
				text-align: center;
				padding: 30px;
				color: var(--vscode-descriptionForeground);
				font-style: italic;
			}
			.no-tests {
				padding: 15px;
			}
			.evidences-section-mini {
				margin-top: 10px;
				padding-top: 10px;
				border-top: 1px dashed var(--vscode-panel-border);
				display: flex;
				gap: 10px;
				flex-wrap: wrap;
			}
			.evidence-thumb-container {
				position: relative;
				display: inline-block;
			}
			.evidence-thumb {
				max-width: 150px;
				max-height: 150px;
				height: auto;
				border: 1px solid var(--vscode-panel-border);
				border-radius: 4px;
				cursor: pointer;
				transition: all 0.3s ease;
				box-shadow: 0 2px 4px rgba(0,0,0,0.1);
			}
			.evidence-thumb:hover {
				box-shadow: 0 4px 8px rgba(0,0,0,0.2);
				transform: scale(1.05);
			}
			.evidence-thumb.enlarged {
				max-width: none;
				max-height: 90vh;
				width: auto;
				position: fixed;
				top: 50%;
				left: 50%;
				transform: translate(-50%, -50%) !important;
				z-index: 1000;
				box-shadow: 0 8px 32px rgba(0,0,0,0.5);
			}
			.evidence-thumb-caption {
				display: block;
				font-size: 0.75em;
				color: var(--vscode-descriptionForeground);
				margin-top: 3px;
				text-align: center;
				max-width: 150px;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}
			.error-mini {
				font-size: 0.8em;
				color: var(--vscode-errorForeground);
			}
		</style>
	</head>
	<body>
		<div class="report-header">
			<h1>📊 Project Report</h1>
			<div style="font-size: 1.1em; margin-top: 10px;">
				<strong>Project:</strong> ${project.name}
			</div>
		</div>

		<h2>📈 Overall Statistics</h2>
		<div class="stats-grid">
			<div class="stat-card">
				<span class="stat-number">${totalRequirements}</span>
				<div class="stat-label">Requirements</div>
			</div>
			<div class="stat-card">
				<span class="stat-number">${totalTests}</span>
				<div class="stat-label">Total Tests</div>
			</div>
			<div class="stat-card" style="border-left-color: #28a745;">
				<span class="stat-number" style="color: #28a745;">${passedTests}</span>
				<div class="stat-label">Passed</div>
			</div>
			<div class="stat-card" style="border-left-color: #dc3545;">
				<span class="stat-number" style="color: #dc3545;">${failedTests}</span>
				<div class="stat-label">Failed</div>
			</div>
			<div class="stat-card" style="border-left-color: #6c757d;">
				<span class="stat-number" style="color: #6c757d;">${notExecutedTests}</span>
				<div class="stat-label">Not Executed</div>
			</div>
		</div>

		<h2>📋 Requirements & Test Cases</h2>
		${requirementsHtml}
	</body>
	</html>`;
}

function deactivate() {}

module.exports = {
	activate,
	deactivate
}
