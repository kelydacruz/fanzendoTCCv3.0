import express from 'express';
import IdeiaController from '../controllers/IdeiaController.js';
import { somenteAutenticado } from '../middleware/autenticacao.js';

const router = express.Router();
const controle = new IdeiaController();

router.get('/ideia/lst', somenteAutenticado, controle.list);
router.get('/ideia/add', somenteAutenticado, controle.openAdd);
router.post('/ideia/add', somenteAutenticado, controle.add);
router.get('/ideia/detalhes/:id', somenteAutenticado, controle.details);
router.get('/ideia/edt/:id', somenteAutenticado, controle.openEdt);
router.post('/ideia/edt/:id', somenteAutenticado, controle.edt);
router.post('/ideia/del/:id', somenteAutenticado, controle.del);
router.post('/ideia/comentario/:id', somenteAutenticado, controle.comment);

router.get('/ideias', somenteAutenticado, (req, res) => res.redirect(`/ideia/lst${req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''}`));

export default router;
