# Configuração de Uploads e Persistência de Imagens

Este projeto utiliza um diretório de uploads para armazenar imagens de clientes, produtos, funcionários e documentos.

## Problema de Imagens Desaparecendo (Deploy/Build)

Se as imagens desaparecem após um novo build ou deploy, isso significa que o diretório de uploads está sendo apagado pelo processo de deploy ou não está sendo persistido (comum em containers Docker ou serviços PaaS).

## Solução

O backend agora suporta uma variável de ambiente `UPLOAD_DIR` para definir o local onde as imagens são salvas.

### 1. Configuração em Produção (VPS/Servidor)

Defina a variável de ambiente `UPLOAD_DIR` para um caminho absoluto **fora** da pasta do projeto ou em um volume persistente.

Exemplo no arquivo `.env` ou configuração do serviço:
```env
UPLOAD_DIR=/var/ayratech/uploads
```

Certifique-se que o usuário do sistema que roda a aplicação (ex: `node` ou `www-data`) tenha permissão de escrita nessa pasta.

### 2. Docker

Se estiver usando Docker, você deve montar um volume para persistir os dados.

Exemplo no `docker-compose.yml`:
```yaml
services:
  backend:
    # ...
    environment:
      - UPLOAD_DIR=/app/uploads
    volumes:
      - ./uploads_data:/app/uploads
```
Ou se usar um caminho externo:
```yaml
    environment:
      - UPLOAD_DIR=/data/uploads
    volumes:
      - ayratech_uploads:/data/uploads
```

### 3. Comportamento Padrão

Se `UPLOAD_DIR` não for definido, o sistema usará `process.cwd() + '/uploads'`.
Isso funciona bem em desenvolvimento local, mas em produção, se a pasta do projeto for substituída a cada deploy, a pasta `uploads` será perdida se estiver dentro dela.

**Recomendação:** Sempre configure `UPLOAD_DIR` para um local seguro e persistente no servidor de produção.
