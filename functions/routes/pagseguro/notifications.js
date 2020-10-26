/* eslint-disable promise/no-nesting */
const pgClient = require('./../../lib/pagseguro/client')
const { paymentStatus } = require('./../../lib/pagseguro/utils')

exports.post = ({ appSdk, admin }, req, res) => {
  const { notificationCode, notificationType } = req.body
  if (notificationType !== 'transaction') {
    return res.sendStatus(204)
  }
  console.log(`> Notification: #${notificationCode}`)

  const checkOrderTransaction = (storeId, pgTrasactionCode, pgTrasactionStatus, isRetry) => {
    const url = `orders.json?transactions.intermediator.transaction_code=${pgTrasactionCode}` +
      '&fields=_id,financial_status,transactions._id,transactions.intermediator,transaction.status'

    return appSdk.apiRequest(storeId, url).then(({ response }) => {
      const { data } = response
      if (data.result && data.result.length) {
        const order = data.result[0]
        if (order && order.transactions) {
          const transaction = order.transactions.find(({ intermediator }) => {
            return intermediator && intermediator.transaction_code === pgTrasactionCode
          })
          if (transaction) {
            const status = paymentStatus(pgTrasactionStatus)
            switch (status) {
              case 'paid':
              case 'pending':
              case 'under_analysis':
                if (
                  (transaction.status && transaction.status.current === status) ||
                  (order.financial_status && order.financial_status.current === status)
                ) {
                  return true
                }
            }

            const url = `orders/${order._id}/payments_history.json`
            return appSdk.apiRequest(storeId, url, 'post', {
              transaction_id: transaction._id,
              date_time: new Date().toISOString(),
              status,
              notification_code: notificationCode,
              flags: ['pagseguro']
            }).then(() => {
              return admin.firestore()
                .collection('pagseguro_transactions')
                .doc(pgTrasactionCode).update({
                  transaction_status: parseInt(pgTrasactionStatus, 10)
                })
            })
          }
        }
      }

      if (!isRetry) {
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            checkOrderTransaction(storeId, pgTrasactionCode, pgTrasactionStatus, true)
              .then(resolve).catch(reject)
          }, 5000)
        })
      }

      const err = new Error('Order not found')
      err.name = 'NotFound'
      throw err
    })
  }

  setTimeout(() => {
    return pgClient({
      url: '/v3/transactions/notifications/' + notificationCode
    }, true).then(({ transaction }) => {
      return admin.firestore().collection('pagseguro_transactions').doc(transaction.code).get()
        .then(doc => {
          if (!doc.exists) {
            const err = new Error('Order not found')
            err.name = 'NotFound'
            throw err
          } else {
            const local = doc.data()
            return checkOrderTransaction(local.transaction_store_id, transaction.code, transaction.status)
          }
        })
    }).then(() => res.status(200).end())
      .catch(err => {
        console.error(err)
        if (err.name !== 'NotFound') {
          console.error(`PgNotificationErr ${notificationCode} ${notificationType}`, err)
        }
        return res.status(500).send(err)
      })
  }, 2000)
}
