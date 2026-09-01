import { mongoose } from '../config/conexao.js';

const TurmaSchema = new mongoose.Schema({
    nome: { type: String, required: true, trim: true, minlength: 2, maxlength: 50 },
    ano: { type: Number, required: true, min: 2000, max: 2200 },
    curso: { type: mongoose.Schema.Types.ObjectId, ref: 'Curso', required: true },
    ativo: { type: Boolean, default: true },
}, { timestamps: true });

TurmaSchema.index({ nome: 1, ano: 1, curso: 1 }, { unique: true });

export default mongoose.models.Turma || mongoose.model('Turma', TurmaSchema);
