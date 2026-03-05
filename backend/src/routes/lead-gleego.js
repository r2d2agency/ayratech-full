import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { query } from '../db.js';
import { log, logError } from '../logger.js';

const router = Router();
router.use(authenticate);

// SSO: gerar token no Lead Extractor e retornar URL de redirecionamento
router.get('/sso', async (req, res) => {
  try {
    const userId = req.userId;

    // Buscar email do usuário logado
    const userResult = await query('SELECT email FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const email = userResult.rows[0].email;
    const apiKey = process.env.GLEEGO_SSO_API_KEY || 'gleego-sso-chave-secreta-2024';

    // Solicitar token ao Lead Extractor (server-side)
    const response = await fetch('https://api.gleego.com.br/api/auth/token-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, apiKey }),
    });

    const data = await response.json();

    if (data.token) {
      const redirectUrl = `https://lead.gleego.com.br/login?token=${data.token}`;
      log(`Lead Gleego SSO success for ${email}`);
      return res.json({ url: redirectUrl });
    } else {
      logError('Lead Gleego SSO failed', { email, response: data });
      return res.status(400).json({ error: data.error || 'Usuário não encontrado no Lead Extractor. Verifique se o email está cadastrado.' });
    }
  } catch (err) {
    logError('Lead Gleego SSO error', err);
    return res.status(500).json({ error: 'Erro ao autenticar no Lead Gleego' });
  }
});

export default router;
