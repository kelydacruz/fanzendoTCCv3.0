import { mongoose } from '../config/conexao.js';

const VerificacaoLoginSchema = new mongoose.Schema({
    usuario: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true,
        index: true,
    },
    identificador: { type: String, required: true, unique: true },
    codigoHash: { type: String, required: true, select: false },
    finalidade: {
        type: String,
        enum: ['login', 'cadastro', 'google', 'admin_login', 'definir_senha', 'confirmar_email'],
        required: true,
    },
    expiraEm: { type: Date, required: true },
    tentativas: { type: Number, default: 0, min: 0 },
    usado: { type: Boolean, default: false },
}, { timestamps: true });

VerificacaoLoginSchema.index({ expiraEm: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.VerificacaoLogin
    || mongoose.model('VerificacaoLogin', VerificacaoLoginSchema);
