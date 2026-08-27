import { mongoose } from '../config/conexao.js';

const TccSchema = new mongoose.Schema({
    titulo: { type: String, required: true, trim: true, minlength: 3, maxlength: 180 },
    tema: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    resumo: { type: String, required: true, trim: true, minlength: 30, maxlength: 3000 },
    curso: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    orientador: { type: String, required: true, trim: true, minlength: 3, maxlength: 100 },
    coautores: [{ type: String, trim: true, maxlength: 100 }],
    palavrasChave: [{ type: String, trim: true, maxlength: 50 }],
    ano: { type: Number, required: true, min: 1980, max: new Date().getFullYear() },
    autor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
    pdf: {
        dados: { type: Buffer, select: false },
        nome: String,
        tipo: String,
    },
}, { timestamps: true });

export default mongoose.models.Tcc || mongoose.model('Tcc', TccSchema);
