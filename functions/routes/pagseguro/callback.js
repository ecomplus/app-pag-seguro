/* eslint-disable promise/no-nesting */
const pgClient = require('./../../lib/pagseguro/client')
const { Timestamp } = require('firebase-admin').firestore

exports.get = ({ appSdk, admin }, req, res) => {
  const db = admin.firestore()
  const { notificationCode } = req.query
  return pgClient({
    url: `/v2/authorizations/notifications/${notificationCode}`
  }, true).then(({ authorization }) => {
    const { code, authorizerEmail, reference, account, permissions } = authorization
    return db.collection('pagseguro_app_auth').doc(code).set({
      permissions,
      authorization_code: code,
      authorizer_email: authorizerEmail,
      public_key: account.publicKey,
      store_id: parseInt(reference, 10),
      created_at: Timestamp.now()
    }).then(() => reference)
  }).then(reference => {
    console.log('Save ps auth for #' + reference)
    res.status(200)
    res.write('Pronto! Você pode fechar a janela')
    return res.end()
  }).catch(e => {
    console.error('PAGSEGURO_AUTH_CALLBACK_ERR:', e)
    res.status(500)
    res.write('Ops! Houve um erro enquanto autorizávamos o aplicativo, tente novamente mais tarde ou informe esse erro na community.e-com.plus')
    return res.end()
  })
}
