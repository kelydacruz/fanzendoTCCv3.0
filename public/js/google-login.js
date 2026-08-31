window.receberCredencialGoogle = function receberCredencialGoogle(resposta) {
    const formulario = document.querySelector('#form-google');
    const campoCredencial = document.querySelector('#credencial-google');

    if (!formulario || !campoCredencial || !resposta?.credential) return;
    campoCredencial.value = resposta.credential;
    formulario.submit();
};
