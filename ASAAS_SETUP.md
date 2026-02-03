# Configuração da Integração Asaas

Este documento descreve como configurar a integração com o Asaas para geração automática de cobranças.

## 1. Pré-requisitos

- Conta no [Asaas](https://www.asaas.com/)
- Projeto Firebase configurado
- Firebase CLI instalado (`npm install -g firebase-tools`)

## 2. Obter API Key do Asaas

1. Acesse sua conta no Asaas
2. Vá em **Minha Conta** → **Integrações** → **Criar nova chave de API**
3. Escolha o ambiente:
   - **Sandbox**: Para testes (cobranças não são reais)
   - **Produção**: Para uso real (cobranças são processadas)
4. Copie a API Key gerada

## 3. Deploy das Cloud Functions

### Instalar dependências das Functions

```bash
cd functions
npm install
```

### Configurar Firebase

```bash
firebase login
firebase use <seu-projeto-firebase>
```

### Deploy

```bash
firebase deploy --only functions
```

Após o deploy, anote a URL do webhook que será algo como:
```
https://us-central1-<SEU-PROJETO>.cloudfunctions.net/asaasWebhook
```

## 4. Configurar Webhook no Asaas

1. Acesse o Asaas
2. Vá em **Minha Conta** → **Integrações** → **Webhooks**
3. Clique em **Criar novo webhook**
4. Preencha:
   - **URL**: A URL do webhook obtida no passo anterior
   - **Eventos**: Selecione os eventos que deseja receber:
     - `PAYMENT_RECEIVED` - Pagamento recebido
     - `PAYMENT_CONFIRMED` - Pagamento confirmado
     - `PAYMENT_OVERDUE` - Pagamento vencido
     - `PAYMENT_DELETED` - Pagamento deletado/cancelado
     - `PAYMENT_REFUNDED` - Pagamento estornado
     - `PAYMENT_UPDATED` - Pagamento atualizado
5. Salve o webhook

## 5. Configurar no Sistema

1. Acesse **Configurações** → **Integrações**
2. Selecione o ambiente (Sandbox ou Produção)
3. Cole a API Key do Asaas
4. Clique em **Testar Conexão** para verificar
5. Salve as configurações

## 6. Uso

### Cadastrar Clientes

1. Acesse **Clientes** → **Novo Cliente**
2. Preencha os dados obrigatórios:
   - Nome completo ou Razão Social
   - E-mail
   - CPF ou CNPJ
3. Após salvar, clique em **Sincronizar** para criar o cliente no Asaas

### Gerar Cobranças

1. Acesse o **Financeiro** ou os detalhes do projeto
2. Na listagem de faturas, clique em **Cobrar** na fatura pendente
3. Selecione:
   - Cliente (deve estar sincronizado com Asaas)
   - Forma de pagamento (PIX, Boleto ou escolha do cliente)
4. Clique em **Gerar Cobrança**
5. O cliente receberá um e-mail com o link de pagamento

### Acompanhar Pagamentos

- Os pagamentos são atualizados automaticamente via webhook
- Quando o cliente pagar, a fatura será marcada como "Paga" automaticamente
- Você pode ver o status da cobrança na coluna "Cobrança" das faturas

## 7. Ambientes

### Sandbox (Testes)

- URL API: `https://sandbox.asaas.com/api/v3`
- Cobranças não são processadas
- Use para testar a integração

### Produção

- URL API: `https://api.asaas.com/v3`
- Cobranças são processadas de verdade
- Use apenas quando estiver pronto para produção

## 8. Troubleshooting

### Erro "API Key inválida"

- Verifique se a API Key está correta
- Confirme se está usando o ambiente correto (Sandbox/Produção)

### Webhook não está atualizando

- Verifique se o webhook foi criado corretamente no Asaas
- Confira os logs das Cloud Functions no Firebase Console
- Certifique-se de que a URL do webhook está correta

### Cliente não encontrado no Asaas

- O cliente precisa estar sincronizado primeiro
- Verifique se o CPF/CNPJ está correto

### Erro ao criar cobrança

- Verifique se o cliente está vinculado ao Asaas
- Confirme se todos os dados obrigatórios estão preenchidos
- Verifique os logs no Firebase Console

## 9. Logs

Para visualizar logs das Cloud Functions:

```bash
firebase functions:log --only asaasWebhook
```

Ou acesse o Console do Firebase:
1. Firebase Console → Functions
2. Selecione a função
3. Veja os logs

## 10. Segurança

- A API Key é armazenada no Firestore
- Recomenda-se usar variáveis de ambiente para produção
- O webhook valida a origem das requisições
- Todas as operações requerem autenticação do usuário






