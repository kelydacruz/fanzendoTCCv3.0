import { mongoose } from '../config/conexao.js';

const TccSchema = new mongoose.Schema({
    titulo: { type: String, required: true, trim: true, minlength: 3, maxlength: 180 },
    tema: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    resumo: { type: String, required: true, trim: true, minlength: 30, maxlength: 3000 },
    curso: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    cursoCadastro: { type: mongoose.Schema.Types.ObjectId, ref: 'Curso', default: null },
    area: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    turma: { type: String, required: true, trim: true, minlength: 2, maxlength: 50 },
    turmaCadastro: { type: mongoose.Schema.Types.ObjectId, ref: 'Turma', default: null },
    orientador: { type: String, required: true, trim: true, minlength: 3, maxlength: 100 },
    orientadorUsuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null },
    coautores: [{ type: String, trim: true, maxlength: 100 }],
    palavrasChave: [{ type: String, trim: true, maxlength: 50 }],
    ano: { type: Number, required: true, min: 1980, max: new Date().getFullYear() },
    visualizacoes: { type: Number, min: 0, default: 0 },
    downloads: { type: Number, min: 0, default: 0 },
    autor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
    ideiaOrigem: { type: mongoose.Schema.Types.ObjectId, ref: 'Ideia', default: null },
    visibilidade: { type: String, enum: ['publico', 'interno'], default: 'interno', index: true },
    status: {
        type: String,
        enum: ['em_analise', 'correcao_solicitada', 'publicado', 'rejeitado'],
        default: 'em_analise',
    },
    feedbackOrientador: { type: String, trim: true, maxlength: 2000, default: '' },
    enviadoEm: { type: Date, default: Date.now },
    avaliadoEm: { type: Date, default: null },
    pdf: {
        dados: { type: Buffer, select: false },
        nome: String,
        tipo: String,
    },
}, { timestamps: true });

TccSchema.index({ autor: 1 }, { unique: true });

export default mongoose.models.Tcc || mongoose.model('Tcc', TccSchema);
