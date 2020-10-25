const { toXML } = require('jstoxml')
const pgClient = require('./../../lib/pagseguro/client')
const { baseUri } = require('./../../__env')
exports.get = ({ appSdk }, req, res) => {
  const { query } = req
  const storeId = query.x_store_id || query.storeId || query.store_id || req.get('x-store-id')

  if (!storeId) {
    return res.status(400).send('You must to specify the store_id in the url: eg; x_store_id=100 or store_id=100 or storeId=100')
  }

  const redirectURL = baseUri + '/pagseguro/callback'
  const notificationURL = baseUri + '/pagseguro/notifications'
  // callback body
  const authConfig = {
    authorizationRequest: {
      reference: storeId,
      permissions: {
        code: [
          'CREATE_CHECKOUTS',
          'RECEIVE_TRANSACTION_NOTIFICATIONS',
          'SEARCH_TRANSACTIONS',
          'MANAGE_PAYMENT_PRE_APPROVALS',
          'DIRECT_PAYMENT'
        ]
      },
      redirectURL,
      notificationURL
    }
  }

  let xml = '<?xml version="1.0" encoding="iso-8859-1" standalone="yes"?>'
  xml += toXML(authConfig)

  return pgClient({
    url: '/v2/authorizations/request',
    method: 'post',
    data: xml
  }, true).then(({ authorizationRequest }) => {
    const { code } = authorizationRequest
    const env = Boolean(process.env.PS_APP_SANDBOX) === true ? 'sandbox.' : ''
    const redirectTo = `https://${env}pagseguro.uol.com.br/v2/authorization/request.jhtml?code=${code}`
    return res.redirect(redirectTo)
  }).catch(e => {
    console.log(e.toJSON())
    return res.status(400).send({
      error: 'REQUEST_AUTH_ERR',
      message: 'PagSeguro authentication error, please try again latter',
      e
    })
  })
}
