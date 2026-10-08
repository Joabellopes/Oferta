# Publicação

O projeto pode ser publicado como um único serviço FastAPI: ele atende a API e os arquivos da pasta `frontend` no mesmo domínio. Isso elimina os endereços `127.0.0.1` no site publicado e evita CORS aberto.

## Antes da primeira publicação

1. **Troque a senha do MySQL.** O `.env` foi removido do índice e está ignorado, mas já apareceu em commits anteriores. Se o repositório foi enviado a algum serviço Git, trate a senha antiga como exposta. Para remover o histórico antigo também, será necessário reescrever o histórico e atualizar o remoto.
2. Crie um banco MySQL gerenciado e configure `DATABASE_URL` ou `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` e `DB_NAME` como variáveis secretas do provedor.
3. Configure `APP_ENV=production`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` com pelo menos 14 caracteres e `ADMIN_SECRET_KEY` com pelo menos 32 caracteres aleatórios. O backend se recusa a iniciar em produção se a autenticação não estiver configurada.
4. Execute `python -m backend.app.database.criar_tabelas` uma vez com as variáveis do banco configuradas. O comando cria as tabelas e as categorias iniciais sem duplicá-las.
5. Configure o comando de início como `uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT` (use a sintaxe de variável de porta do provedor escolhido).
6. Ative HTTPS no provedor e conecte o domínio depois que o serviço estiver saudável em `/health`.

O modelo `.env.example` mostra os nomes das variáveis locais. Não envie `.env` ao Git nem cole os valores secretos em mensagens ou arquivos de documentação.

Se o provedor fornecer `MYSQL_URL` ou as variáveis `MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD` e `MYSQLDATABASE`, o backend reconhece esses nomes.

Para habilitar a busca assistida do Mercado Livre no painel, configure `MELI_ACCESS_TOKEN` como variável secreta. O token deve vir de um aplicativo autorizado via OAuth e nunca deve ser enviado ao navegador ou registrado em logs. O botão de importação apenas preenche o formulário; revise os dados e adicione o link de afiliado antes de cadastrar.

No cadastro de ofertas, imagens JPG, PNG e WebP de até 5 MB podem ser enviadas pelo painel e ficam em `frontend/uploads/`. Em hospedagem, configure um volume persistente nesse diretório ou armazenamento de objetos; o disco local de alguns provedores é temporário entre implantações.

## Opção prática para começar

Como o projeto já usa MySQL, Railway é uma opção direta para hospedar a API/site e criar o MySQL no mesmo projeto. A plataforma oferece um domínio temporário `*.railway.app` e SSL automático, então dá para validar o site antes de comprar um domínio próprio. O plano Hobby tem mínimo de US$ 5 por mês, incluindo US$ 5 de uso; consumo acima disso é cobrado à parte. Consulte a [documentação MySQL](https://docs.railway.com/databases/mysql), [domínios e SSL](https://docs.railway.com/networking/public-networking) e [preços atuais](https://railway.com/pricing) antes de criar o serviço.

## Desenvolvimento local

- API e site unificado: `uvicorn backend.app.main:app --reload --port 8000`; acesse `http://127.0.0.1:8000`.
- Para manter o fluxo atual com o Live Server na porta 5500, inicie também a API em `127.0.0.1:8000`.
- O painel não exige login no modo local quando `APP_ENV=development` e as variáveis `ADMIN_*` estão ausentes. Em produção, todas são obrigatórias.

## Verificação antes de divulgar

- Abra `/health`, a home, `/admin.html` e uma URL de produto `oferta.html?id=...`.
- Entre no painel e valide criar, editar e excluir um produto de teste; depois confirme a busca e o link de afiliado com um produto real.
- Verifique imagens em HTTPS, preços, categorias, navegação e layout em celular e desktop.
- Confirme backup automático do MySQL, domínio/HTTPS, credenciais administrativas e a troca da senha antiga do banco.

## Itens que dependem de contas ou decisões externas

- Ainda não há integração automática com Mercado Livre, Shopee, Telegram ou WhatsApp.
- Analytics não está configurado; defina ferramenta e política de consentimento antes de ativar rastreamento.
- O admin aceita URL de imagem; upload de arquivo local não está implementado nesta versão.
- Sitemap e URL canônica precisam do domínio público definitivo.
- Política de privacidade, termos e contato público precisam dos dados de contato do responsável e da confirmação do provedor/analytics escolhido; não inventei esses dados.
- O repositório contém commits antigos com `.env`; apagar o arquivo atual não remove esses valores do histórico Git.
