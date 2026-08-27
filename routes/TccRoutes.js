import express from 'express';
import multer from 'multer';
import TccController from '../controllers/TccController.js';
import { somenteAutenticado, somenteAluno } from '../middleware/autenticacao.js';

const router = express.Router();
const controle = new TccController();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, callback) => {
        if (file.mimetype !== 'application/pdf') return callback(new Error('Envie apenas arquivos PDF.'));
        return callback(null, true);
    },
});

router.get('/tcc/lst', controle.list);
router.get('/tcc/add', somenteAluno, controle.openAdd);
router.post('/tcc/add', somenteAluno, upload.single('pdf'), controle.add);
router.get('/tcc/detalhes/:id', controle.details);
router.get('/tcc/pdf/:id', controle.pdf);
router.get('/tcc/edt/:id', somenteAluno, controle.openEdt);
router.post('/tcc/edt/:id', somenteAluno, upload.single('pdf'), controle.edt);
router.post('/tcc/del/:id', somenteAluno, controle.del);
router.post('/tcc/comentario/:id', somenteAutenticado, controle.comment);

router.get('/tccs', (req, res) => res.redirect(`/tcc/lst${req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''}`));
router.get('/tccs/:id', (req, res) => res.redirect(`/tcc/detalhes/${req.params.id}`));

export default router;
