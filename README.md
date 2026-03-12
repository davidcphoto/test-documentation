# Test Documentation

Uma extensão do VS Code para gestão completa de documentação de testes, permitindo criar projectos de teste, requisitos, casos de teste e evidências.

## Funcionalidades

### 🗂️ Gestão de Projectos de Teste
- Criar projectos de teste com nome e descrição
- Visualizar todos os projectos numa TreeView
- Eliminar projectos

### 📋 Gestão de Requisitos
- Adicionar requisitos de teste a cada projecto
- Cada requisito pode ter nome e descrição
- Visualizar requisitos organizados por projecto
- Eliminar requisitos

### ✅ Gestão de Casos de Teste
- Criar casos de teste associados a cada requisito
- Definir resultado esperado para cada caso
- Eliminar casos de teste

### 🧪 Execução de Testes
- Executar testes registando:
  - Nome de quem executou
  - Data e hora da execução
  - Status (Passou/Falhou)
  - Observações adicionais
- Visualização de status com ícones coloridos:
  - ✓ Verde para testes que passaram
  - ✗ Vermelho para testes que falharam
  - ○ Cinzento para testes não executados

### 📊 Status Hierárquico Automático
- **Requisitos**: Marcados como "passados" quando todos os seus casos de teste passam
- **Projectos**: Marcados como "passados" quando todos os requisitos passam
- Ícones dinâmicos que refletem o estado actual:
  - Verde (✓) quando tudo passou
  - Vermelho (✗) quando há falhas
  - Padrão quando não executado ou parcialmente executado
- Contadores automáticos: "X/Y passed" em requisitos e projectos

### 📸 Evidências de Teste
- Adicionar screenshots como evidências
- **Editor de crop interactivo**: Recorte a área relevante do screenshot
- Suporte para múltiplos formatos de imagem (PNG, JPG, JPEG, GIF, BMP)
- Rastreamento de evidências com nome do ficheiro, caminho e data
- Indicação visual se a imagem foi recortada
- Visualizar todas as evidências associadas a um caso de teste

### 📊 Visualização Detalhada
- Ver detalhes completos de casos de teste numa interface webview
- **Visualização de imagens**: As evidências (screenshots) são exibidas diretamente na webview
- Clique nas imagens para ampliar em ecrã inteiro
- Informações incluem:
  - Nome e resultado esperado
  - Status de execução
  - Executor e data
  - Observações
  - Lista de evidências com imagens e caminhos

## Como Usar

### 1. Criar um Projecto de Teste
1. Clique no ícone "+" na barra de título da vista "Test Projects"
2. Insira o nome do projecto
3. Opcionalmente, insira uma descrição

### 2. Adicionar Requisitos
1. Clique no ícone "+" ao lado do projecto
2. Insira o nome do requisito (ex: "REQ-001: Login")
3. Opcionalmente, insira uma descrição

### 3. Adicionar Casos de Teste
1. Clique no ícone "+" ao lado do requisito
2. Insira o nome do caso de teste (ex: "TC-001: Login válido")
3. Insira o resultado esperado

### 4. Executar um Teste
1. Clique no ícone "▶" ao lado do caso de teste
2. Insira o seu nome
3. Seleccione se o teste passou ou falhou
4. Opcionalmente, adicione observações

### 5. Adicionar Evidências
1. Clique com o botão direito no caso de teste
2. Seleccione "Add Evidence (Screenshot)"
3. Escolha uma das opções:
   - **📸 Capture Screenshot**: Captura automática
     - **Imediato**: Captura o ecrã imediatamente
     - **Com Delay de 3s**: Permite mudar para a janela desejada antes de capturar
       - Insira uma descrição opcional para o screenshot
       - Mude para a janela que deseja capturar
       - Aguarde 3 segundos
   - **📁 Select Existing Files**: Seleccione ficheiros de imagem existentes
4. **Após capturar**, escolha se deseja recortar a imagem:
   - **✂️ Crop Image**: Abre editor interactivo para seleccionar área
     - Clique e arraste para seleccionar a área desejada
     - Clique "Crop & Save" para guardar apenas a área seleccionada
     - Ou "Skip Crop" para usar a imagem completa
   - **✓ Use Full Image**: Usa a captura completa sem recortar
5. Os screenshots são guardados na pasta `test-evidences/` do workspace

### 6. Ver Detalhes do Teste
1. Clique com o botão direito no caso de teste
2. Seleccione "View Test Details"
3. Uma vista detalhada abrirá com:
   - Informações completas do teste
   - **Todas as evidências (screenshots) exibidas como imagens**
   - Clique numa imagem para ampliar em ecrã inteiro
   - Metadata de cada evidência

## Estrutura de Dados

Os dados são armazenados localmente no VS Code usando `globalState`, permitindo que os seus projectos de teste sejam persistidos entre sessões.

### Hierarquia e Status
```
✓ Projecto (Passou - todos requisitos passaram)
├── ✓ Requisito 1 (Passou - todos testes passaram)
│   ├── ✓ Caso de Teste 1 (Passed)
│   └── ✓ Caso de Teste 2 (Passed)
├── ✗ Requisito 2 (Falhou - pelo menos um teste falhou)
│   ├── ✓ Caso de Teste 3 (Passed)
│   └── ✗ Caso de Teste 4 (Failed)
└── 📄 Requisito 3 (Pendente - testes não executados)
    └── ○ Caso de Teste 5 (Not executed)
```

**Regras de Status:**
- ✓ **Requisito passa**: quando TODOS os casos de teste passam
- ✓ **Projecto passa**: quando TODOS os requisitos passam
- Os ícones e cores actualizam automaticamente

## Requisitos

- VS Code versão 1.111.0 ou superior
- Node.js e npm (para instalar dependências)

## Instalação

### Para Utilizadores
1. Instale a extensão do VS Code Marketplace (quando publicada)
2. A extensão irá instalar automaticamente as dependências necessárias

### Para Desenvolvimento
1. Clone o repositório
2. Execute `npm install` para instalar dependências
3. Pressione F5 para abrir uma nova janela do VS Code com a extensão carregada

**Nota**: A funcionalidade de captura de screenshots requer as dependências `screenshot-desktop` e `active-win` que serão instaladas automaticamente com `npm install`.

## Notas de Versão

### 0.0.1

Versão inicial com funcionalidades completas:
- Gestão de projectos, requisitos e casos de teste
- Execução de testes com rastreamento completo
- Sistema de evidências com captura automática de screenshots:
  - Captura imediata
  - Captura com delay de 3 segundos para selecção de janela
  - **Editor de crop interactivo**: Recorte visual da imagem capturada
  - Importação de ficheiros de imagem existentes
- TreeView interactiva com status hierárquico
- **Visualização detalhada de testes com galeria de imagens**:
  - Screenshots exibidos directamente na webview
  - Clique para ampliar imagens
  - Indicação se a imagem foi recortada
  - Interface responsiva com tema do VS Code
- Ícones coloridos baseados no status (verde/vermelho/cinzento)
- Screenshots guardados automaticamente em `test-evidences/`

## Licença

[Defina a sua licença aqui]

---

**Aproveite a documentação estruturada dos seus testes!**
