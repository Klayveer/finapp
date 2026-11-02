# FinApp

Controle financeiro pessoal: balanço mensal, cartões (limite, faturas, parcelas, milhas) e transações (salário recorrente, rendas extras, Pix, boletos…).

Site **100% estático**, sem etapa de build e sem dependências para instalar. Sobe de graça no GitHub Pages, Vercel, Netlify ou Cloudflare Pages.

## Telas

| Tela | O que faz |
|---|---|
| **Painel** | Saldo do mês, entradas x saídas dos últimos 6 meses, gastos por categoria e por forma de pagamento, gastos fixos x variáveis, faturas dos cartões, pontos do mês e maiores gastos |
| **Transações** | Lançamentos do mês agrupados por dia, com filtros e busca. Painel de **fixos mensais** (salário, aluguel, assinaturas) |
| **Cartões** | Cartões com validade, limite usado e disponível, fechamento e vencimento, fatura por mês (aberta, fechada ou futura), parcelas e pontos/milhas estimados |
| **Ajustes** | Tema claro/escuro, cotação do dólar (para calcular milhas), backup em JSON (exportar/importar), dados de exemplo |

### Regras de cálculo
- **Compras no cartão** contam no mês em que a fatura **vence**, que é quando o dinheiro sai de fato. Compra feita no dia do fechamento ou depois vai para a fatura seguinte.
- **Parcelas**: uma por fatura. A última parcela absorve os centavos que sobram da divisão.
- **Recorrentes**: repetem todo mês a partir da primeira data. "Encerrar" define o último mês e preserva o histórico.
- **Milhas**: `valor da fatura ÷ cotação do dólar × pontos por US$`, ou `valor × pontos por R$`.

---

## Rodar localmente

Abrir o `index.html` direto (via `file://`) não funciona porque os módulos JS exigem um servidor. Use um destes:

```bash
npx serve .            # ou: npm run dev
# ou
python -m http.server 5173
```

Depois, abra http://localhost:5173 (ou a porta que o comando mostrar).

---

## Dois modos de armazenamento

### 1. Modo local (padrão, zero configuração)
Com `js/config.js` vazio, a conta e os dados ficam no `localStorage` do navegador.
- ✅ Funciona na hora, sem servidor.
- ⚠️ Os dados ficam **só naquele navegador/dispositivo** e a senha funciona apenas como uma trava de acesso, sem criptografar os dados. Exporte backups em **Ajustes → Exportar**.

### 2. Modo nuvem com Supabase (recomendado para uso real, grátis)
Tem login de verdade e sincroniza celular e computador.

1. Crie uma conta em [supabase.com](https://supabase.com) e depois um projeto (o plano Free basta).
2. Abra **SQL Editor → New query**, cole o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) e clique em **Run**.
3. Em **Project Settings → API**, copie a **Project URL** e a chave **anon public**.
4. Cole as duas em [`js/config.js`](js/config.js):
   ```js
   export const CONFIG = {
     SUPABASE_URL: 'https://xxxx.supabase.co',
     SUPABASE_ANON_KEY: 'eyJhbGciOi...',
   };
   ```
5. Abra o app, clique em **Primeiro acesso? Criar conta** e confirme o e-mail que o Supabase enviar.
6. **Importante:** depois de criar a sua conta, desative novos cadastros em **Authentication → Sign In / Providers → "Allow new users to sign up"** (desligue). Assim, ninguém mais consegue criar conta no seu app.
7. (Opcional) Em **Authentication → URL Configuration**, coloque a URL do seu site em *Site URL*, para que o link de confirmação de e-mail aponte para ele.

> A chave `anon` pode ser pública, porque é feita para ficar no navegador. Quem protege os dados são as políticas **RLS** do `schema.sql`: cada usuário só consegue ler e escrever os próprios registros.

Para levar dados do modo local para a nuvem: **Exportar** no modo local, configurar o Supabase, entrar e depois **Importar**.

---

## Deploy

### GitHub Pages
```bash
git init
git add .
git commit -m "FinApp"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/finapp.git
git push -u origin main
```
No GitHub, vá em **Settings → Pages → Build and deployment → Source: Deploy from a branch → `main` / `(root)`**. Em cerca de 1 minuto, o app estará em `https://SEU_USUARIO.github.io/finapp/`.

### Vercel
1. Em [vercel.com](https://vercel.com), clique em **Add New → Project** e importe o repositório.
2. Em *Framework Preset*, escolha **Other**. Deixe o *Build Command* vazio e o *Output Directory* como `.`
3. Clique em **Deploy**.

Ou, pelo terminal: `npx vercel --prod`.

> O roteamento usa `#/rota`, então não precisa configurar rewrites em nenhum host.

---

## Estrutura

```
index.html            # casca do app
css/style.css         # visual (tokens claro/escuro, responsivo)
js/config.js          # ← suas chaves do Supabase (ou vazio = modo local)
js/app.js             # roteador e layout
js/store.js           # dados e login (backend local ou Supabase)
js/finance.js         # regras: faturas, parcelas, recorrências, milhas
js/forms.js           # formulários de lançamento e de cartão
js/charts.js          # gráficos em SVG, sem bibliotecas
js/views/*.js         # telas: login, painel, transações, cartões, ajustes
supabase/schema.sql   # tabela + políticas de segurança
```
