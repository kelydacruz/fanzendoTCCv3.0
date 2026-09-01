import { mongoose } from '../config/conexao.js';

const CursoSchema = new mongoose.Schema({
    nome: { type: String, required: true, unique: true, trim: true, minlength: 2, maxlength: 100 },
    sigla: { type: String, required: true, trim: true, minlength: 2, maxlength: 20, uppercase: true },
    area: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    ativo: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.models.Curso || mongoose.model('Curso', CursoSchema);
