import { mongoose } from '../config/conexao.js';

const UsuarioSchema = new mongoose.Schema({
    nome: { type: String, required: true, trim: true, minlength: 3, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 150 },
    senha: { type: String, required: true },
    perfil: { type: String, enum: ['aluno', 'professor'], required: true },
    curso: { type: String, trim: true, maxlength: 100, default: '' },
    areaAtuacao: { type: String, trim: true, maxlength: 100, default: '' },
}, { timestamps: true });

export default mongoose.models.Usuario || mongoose.model('Usuario', UsuarioSchema);
