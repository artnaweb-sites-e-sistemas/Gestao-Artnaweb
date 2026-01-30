# Configuração de Regras de Segurança do Firebase

## Passo a Passo para Configurar as Regras

### 1. Acessar o Firebase Console

1. Acesse [https://console.firebase.google.com/](https://console.firebase.google.com/)
2. Selecione o projeto **gestao-artnaweb**

### 2. Navegar até Firestore Database

1. No menu lateral, clique em **Firestore Database**
2. Clique na aba **Regras** (Rules)

### 3. Configurar as Regras

#### Opção A: Regras Públicas (Apenas para Desenvolvimento)

Use estas regras apenas durante o desenvolvimento. **NÃO use em produção!**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /projects/{projectId} {
      allow read, write: if true;
    }
    match /categories/{categoryId} {
      allow read, write: if true;
    }
  }
}
```

#### Opção B: Regras com Autenticação (Recomendado para Produção)

Se você implementar autenticação no futuro, use estas regras:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /projects/{projectId} {
      allow read: if request.auth != null;
      allow create, update, delete: if request.auth != null;
    }
    match /categories/{categoryId} {
      allow read: if request.auth != null;
      allow create, update, delete: if request.auth != null;
    }
  }
}
```

#### Opção C: Regras Híbridas (Leitura Pública, Escrita Autenticada)

Permite que qualquer pessoa leia, mas apenas usuários autenticados podem escrever:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /projects/{projectId} {
      allow read: if true;
      allow create, update, delete: if request.auth != null;
    }
    match /categories/{categoryId} {
      allow read: if true;
      allow create, update, delete: if request.auth != null;
    }
  }
}
```

### 4. Publicar as Regras

1. Cole as regras no editor
2. Clique em **Publicar** (Publish)
3. Aguarde a confirmação

## Importante: Período de Teste

O Firebase oferece um período de teste de 30 dias onde as regras são mais permissivas. Após esse período, as regras serão aplicadas estritamente.

## Verificando as Regras

1. Use o **Simulador de Regras** no Firebase Console para testar
2. Teste diferentes cenários:
   - Leitura de documentos
   - Criação de documentos
   - Atualização de documentos
   - Exclusão de documentos

## Segurança Adicional

### 1. Índices Compostos

Se você usar queries complexas, pode ser necessário criar índices:

1. Vá para **Firestore Database** > **Índices**
2. Clique em **Criar Índice**
3. Configure conforme necessário

### 2. Validação de Dados

Você pode adicionar validação nas regras:

```javascript
match /projects/{projectId} {
  allow create: if request.resource.data.keys().hasAll(['name', 'client', 'type', 'status'])
                && request.resource.data.name is string
                && request.resource.data.name.size() > 0;
  allow update: if request.resource.data.diff(resource.data).affectedKeys().hasOnly(['name', 'client', 'description', 'type', 'status', 'progress', 'updatedAt']);
}
```

## Troubleshooting

### Erro: "Missing or insufficient permissions"

- Verifique se as regras foram publicadas
- Verifique se está usando a sintaxe correta
- Verifique se o período de teste não expirou

### Erro: "The query requires an index"

- Crie o índice sugerido pelo Firebase
- Ou ajuste a query para não precisar do índice

## Arquivo de Regras Local

O arquivo `firestore.rules` neste projeto contém as regras básicas. Você pode:

1. Copiar o conteúdo para o Firebase Console
2. Ou usar o Firebase CLI para fazer deploy:
   ```bash
   firebase deploy --only firestore:rules
   ```








