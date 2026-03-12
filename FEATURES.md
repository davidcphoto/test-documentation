# Funcionalidades Detalhadas - Test Documentation

## Sistema de Captura de Screenshots

A extensão oferece três métodos para adicionar evidências aos casos de teste:

### 1. 📸 Captura Imediata
- Captura o ecrã imediatamente
- Ideal para: Capturas rápidas do estado atual
- Processo:
  1. Seleccione "Capture Screenshot" → "Capture Immediate Screenshot"
  2. Screenshot tirado imediatamente
  3. Opção de recortar a imagem
  4. Guardado em `test-evidences/TIMESTAMP.png`

### 2. 🪟 Captura com Delay de 3 Segundos (Recomendado para Testes)
- Aguarda 3 segundos antes de capturar
- Permite mudar para a janela desejada
- Permite adicionar descrição personalizada
- Ideal para: Focar na aplicação específica sendo testada
- Processo:
  1. Seleccione "Capture Screenshot" → "Capture with 3s Delay"
  2. Insira descrição opcional (ex: "Login Screen")
  3. Vê notificação "Switch to window... Screenshot in 3 seconds"
  4. **Mude para a janela que deseja capturar**
  5. Aguarde a captura automática
  6. Opção de recortar a imagem
  7. Screenshot guardado com descrição: `LoginScreen_TIMESTAMP.png`

### 3. 📁 Selecção de Ficheiros Existentes
- Importa imagens já existentes
- Suporta múltiplos ficheiros
- Formatos: PNG, JPG, JPEG, GIF, BMP
- Ideal para: Evidências já capturadas ou documentação externa

## ✂️ Editor de Crop Interactivo

### Funcionalidade de Recorte de Imagem
Após capturar um screenshot, você pode escolher recortar a área relevante:

#### Interface do Editor de Crop
- **Canvas interactivo**: Visualização da imagem capturada
- **Selecção de área**: Clique e arraste para seleccionar a região desejada
- **Feedback visual**: 
  - Retângulo verde tracejado mostra a área seleccionada
  - Preenchimento semi-transparente verde
  - Visualização em tempo real das dimensões (largura x altura)
- **Informações de selecção**: Mostra o tamanho da área seleccionada em pixels

#### Controlos do Editor
1. **Crop & Save**: Recorta e salva apenas a área seleccionada
2. **Skip Crop (Use Full Image)**: Mantém a imagem completa sem recortar
3. **Cancel**: Cancela a captura e descarta a imagem

#### Processo de Crop
1. Após capturar, escolha "✂️ Crop Image"
2. Editor abre com a imagem capturada
3. Clique e arraste com o rato para seleccionar a área
4. Veja as dimensões em tempo real
5. Clique "Crop & Save" para confirmar
6. Imagem original é substituída pela versão recortada
7. Nome do ficheiro actualizado: `cropped_TIMESTAMP.png`

#### Vantagens do Crop
- **Foco no essencial**: Remova informações irrelevantes
- **Redução de tamanho**: Ficheiros menores ocupam menos espaço
- **Privacidade**: Remova informação sensível antes de guardar
- **Clareza**: Destaque apenas a parte relevante para o teste

### Armazenamento de Evidências
- Pasta: `test-evidences/` (criada automaticamente no workspace)
- Formato de nome: 
  - Imagem completa: `[Descricao_]AAAA-MM-DDTHH-MM-SS.png`
  - Imagem recortada: `cropped_AAAA-MM-DDTHH-MM-SS.png`
- Metadata guardada:
  - Nome do ficheiro
  - Caminho completo
  - Data de adição
  - Tipo de captura (Immediate Capture, Delayed Capture, Imported File)
  - Descrição (se fornecida)
  - **Estado de crop**: Indica se a imagem foi recortada (✂️)

## Visualização de Evidências

### Webview de Detalhes do Teste
Ao seleccionar "View Test Details" num caso de teste, abre-se uma interface webview completa com:

#### Informações do Teste
- Nome do caso de teste
- Status (Passed/Failed/Not Executed) com badge colorido
- Resultado esperado
- Executor e data de execução
- Observações

#### Galeria de Evidências
- **Visualização de imagens**: Todas as evidências são exibidas como imagens
- **Clique para ampliar**: Clique numa imagem para ver em tamanho real
- **Modo de ecrã inteiro**: As imagens ampliadas são exibidas centralizadas
- **Metadata de cada evidência**:
  - Número e nome do ficheiro
  - Tipo de captura
  - Descrição (se fornecida)
  - Caminho completo do ficheiro
  - Data e hora de adição

#### Funcionalidades da Visualização
- **Responsive**: Imagens ajustam-se automaticamente ao tamanho da janela
- **Tema do VS Code**: Interface usa as cores do tema actual do VS Code
- **Hover effects**: Efeitos visuais ao passar o rato sobre as imagens
- **Toggle expand**: Clique novamente na imagem ampliada para voltar ao tamanho normal

### Exemplo de Uso
1. Execute um teste e adicione evidências (screenshots)
2. Clique com botão direito no caso de teste
3. Seleccione "View Test Details"
4. Veja todas as imagens directamente na interface
5. Clique numa imagem para ampliar
6. Clique novamente para voltar ao tamanho normal

## Sistema de Status Hierárquico

A extensão implementa um sistema de status que propaga automaticamente os resultados dos testes através da hierarquia:

### Casos de Teste (Nível Base)
- **Não Executado**: Ícone cinzento (○)
- **Passou**: Ícone verde (✓) 
- **Falhou**: Ícone vermelho (✗)

### Requisitos (Nível Intermédio)
Um requisito é considerado **passado** quando:
- Tem pelo menos 1 caso de teste
- **TODOS** os casos de teste foram executados
- **TODOS** os casos de teste passaram

Ícones:
- **✓ Verde**: Todos os testes passaram
- **✗ Vermelho**: Pelo menos um teste falhou
- **📄 Padrão**: Testes não executados ou parcialmente executados

Descrição mostra: `X test cases | Y/Z passed`

### Projectos (Nível Superior)
Um projecto é considerado **passado** quando:
- Tem pelo menos 1 requisito
- **TODOS** os requisitos estão passados (o que significa que todos os seus testes passaram)

Ícones:
- **✓ Verde**: Todos os requisitos passaram (todos os testes de todos os requisitos passaram)
- **✗ Vermelho**: Pelo menos um teste falhou em algum requisito
- **📂 Padrão**: Testes não executados ou parcialmente executados

Descrição mostra: `X requirements | Y/Z passed` ou `✓ All Passed`

## Fluxo de Trabalho Recomendado

1. **Criar Projecto** → Define o contexto geral
2. **Adicionar Requisitos** → Define o que precisa ser testado
3. **Criar Casos de Teste** → Define como testar cada requisito
4. **Executar Testes** → Registar resultados
5. **Adicionar Evidências** → Screenshots de comprovação
6. **Monitorizar Status** → Ver automaticamente o progresso hierárquico

## Exemplo Prático

```
Projecto: Sistema de Login
├── ✓ REQ-001: Autenticação (2 test cases | 2/2 passed)
│   ├── ✓ TC-001: Login válido (Passed)
│   └── ✓ TC-002: Password inválida (Passed)
├── ✗ REQ-002: Recuperação de Password (2 test cases | 1/2 passed)
│   ├── ✓ TC-003: Email válido (Passed)
│   └── ✗ TC-004: Email inválido (Failed)
└── 📄 REQ-003: Logout (1 test cases)
    └── ○ TC-005: Logout normal (Not executed)

Status do Projecto: ✗ Vermelho (porque REQ-002 tem um teste falhado e REQ-003 não está completo)
```

## Vantagens do Sistema

- **Visibilidade Instantânea**: Ver rapidamente o estado geral do projecto
- **Rastreamento Hierárquico**: Identificar facilmente onde estão os problemas
- **Gestão de Qualidade**: Garantir que nada passa despercebido
- **Relatório Visual**: Os ícones coloridos facilitam a compreensão
