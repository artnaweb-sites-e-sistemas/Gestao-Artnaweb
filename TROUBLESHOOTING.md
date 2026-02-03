# Troubleshooting - Problemas com Firebase

## Problema: Atividades ou Membros não estão sendo salvos

### 1. Verificar Regras do Firestore

**IMPORTANTE:** As regras do Firestore precisam estar publicadas no Firebase Console.

1. Acesse: https://console.firebase.google.com/
2. Selecione o projeto: **gestao-artnaweb**
3. Vá em **Firestore Database** > **Regras**
4. Certifique-se de que as regras incluem:

```javascript
match /activities/{activityId} {
  allow read, write: if true;
}

match /teamMembers/{memberId} {
  allow read, write: if true;
}
```

5. Clique em **Publicar**

### 2. Verificar Console do Navegador

Abra o Console do Navegador (F12) e verifique:

- **Erros de permissão**: Se aparecer "Missing or insufficient permissions"
  - Solução: Verifique se as regras foram publicadas
  
- **Erros de índice**: Se aparecer "The query requires an index"
  - Solução: Clique no link fornecido pelo erro para criar o índice automaticamente

- **Erros de conexão**: Se aparecer erros de rede
  - Solução: Verifique sua conexão com a internet

### 3. Verificar Estrutura dos Dados

Os dados devem ter a seguinte estrutura:

**Atividade:**
```javascript
{
  projectId: "string",
  text: "string",
  icon: "string",
  userName: "string",
  createdAt: Date
}
```

**Membro da Equipe:**
```javascript
{
  projectId: "string",
  name: "string",
  role: "string (opcional)",
  avatar: "string",
  email: "string (opcional)",
  addedAt: Date
}
```

### 4. Testar Manualmente

1. Abra o Console do Navegador (F12)
2. Tente adicionar uma atividade ou membro
3. Verifique os logs no console:
   - Deve aparecer: "Saving activity to Firestore:" ou "Saving team member to Firestore:"
   - Se aparecer erro, copie a mensagem completa

### 5. Verificar Firebase Console

1. Acesse o Firebase Console
2. Vá em **Firestore Database** > **Dados**
3. Verifique se as coleções `activities` e `teamMembers` existem
4. Verifique se os documentos estão sendo criados

### 6. Problemas Comuns

#### Erro: "permission-denied"
- **Causa**: Regras do Firestore não permitem escrita
- **Solução**: Publique as regras corretas no Firebase Console

#### Erro: "failed-precondition"
- **Causa**: Query precisa de índice composto
- **Solução**: O código já ordena em memória, mas se persistir, crie o índice sugerido

#### Dados não aparecem após salvar
- **Causa**: Problema com a subscription em tempo real
- **Solução**: Verifique se o `projectId` está correto

### 7. Limpar Cache e Testar

1. Limpe o cache do navegador (Ctrl+Shift+Delete)
2. Recarregue a página (Ctrl+F5)
3. Tente adicionar novamente

### 8. Verificar ID do Projeto

Certifique-se de que o `project.id` está sendo passado corretamente. O ID deve ser uma string válida.

Se o problema persistir, verifique os logs no console do navegador e compartilhe a mensagem de erro completa.













