import { mongoose } from '../config/conexao.js';

const UsuarioSchema = new mongoose.Schema({
    nome: { type: String, required: true, trim: true, minlength: 3, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 150 },
    senha: { type: String, default: '', select: false },
    googleId: { type: String, unique: true, sparse: true, select: false },
    emailVerificado: { type: Boolean, default: false },
    ultimoLogin: { type: Date, default: null },
    perfil: { type: String, enum: ['aluno', 'professor', 'colaborador', 'admin'], required: true },
    ativo: { type: Boolean, default: true },
    curso: { type: String, trim: true, maxlength: 100, default: '' },
    areaAtuacao: { type: String, trim: true, maxlength: 100, default: '' },
}, { timestamps: true });

export default mongoose.models.Usuario || mongoose.model('Usuario', UsuarioSchema);
