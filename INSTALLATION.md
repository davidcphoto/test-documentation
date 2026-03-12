# Guia de Instalação Rápida

## Instalação das Dependências

Antes de usar a extensão, você precisa instalar as dependências necessárias:

### Passo 1: Instalar Dependências
Abra o terminal no VS Code e execute:

```bash
npm install
```

Isto irá instalar:
- `screenshot-desktop` - Para capturar screenshots
- `sharp` - Para recortar e processar imagens

### Passo 2: Testar a Extensão
Pressione **F5** para abrir uma nova janela do VS Code com a extensão carregada.

## Funcionalidade de Captura de Screenshots

### Captura Imediata
- Captura o ecrã imediatamente ao ser selecionada
- Útil para capturar o estado atual rapidamente

### Captura com Delay de 3 Segundos (Recomendado)
1. Clique em "Capture with 3s Delay"
2. Insira uma descrição opcional (ex: "Login Screen", "Error Dialog")
3. Aguarde a notificação "Screenshot in 3 seconds..."
4. **Mude para a janela que deseja capturar**
5. Aguarde a captura automática
6. O screenshot será guardado em `test-evidences/`

## Editor de Crop Interactivo

### Como Usar o Crop
Após capturar qualquer screenshot, você pode recortar a área relevante:

1. **Escolha "Crop Image"** quando perguntado
2. **Editor abre** com a imagem capturada
3. **Clique e arraste** para seleccionar a área desejada
4. **Veja as dimensões** da selecção em tempo real
5. **Opções disponíveis**:
   - **Crop & Save**: Salva apenas a área seleccionada
   - **Skip Crop**: Usa a imagem completa
   - **Cancel**: Descarta a captura

### Dicas para Crop
- Seleccione uma área de pelo menos 10x10 pixels
- A área seleccionada é mostrada com bordas verdes tracejadas
- Use crop para remover informações irrelevantes ou sensíveis
- Imagens recortadas têm o prefixo `cropped_` no nome

### Dicas
- Use a captura com delay para ter tempo de focar na janela desejada
- Adicione descrições significativas aos screenshots para facilitar identificação
- Os screenshots são nomeados automaticamente com:
  - Descrição fornecida (se aplicável)
  - Timestamp
  - Formato: `Descricao_2026-03-12T10-30-45.png` ou `2026-03-12T10-30-45.png`

## Resolução de Problemas

### Erro: "Cannot find module 'screenshot-desktop'"
Execute `npm install` na raiz do projeto.

### Erro: "Screenshot module not available"
Verifique se executou `npm install` e se a instalação foi bem-sucedida.

### Screenshots não aparecem
1. Verifique se a pasta `test-evidences/` foi criada no workspace
2. Confirme que tem permissões de escrita no workspace
3. Verifique a consola do VS Code (Help → Toggle Developer Tools) para mensagens de erro

## Estrutura de Pastas

```
workspace/
├── test-evidences/          # Screenshots capturados (auto-criada)
│   ├── MyApp_2026-03-12T10-30-45.png
│   ├── Browser_2026-03-12T10-31-20.png
│   └── ...
└── ... (resto do projeto)
```

**Nota**: A pasta `test-evidences/` está no `.gitignore` para não versionar screenshots no Git.
