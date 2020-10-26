/* eslint-disable promise/no-nesting */
const { firestore } = require('firebase-admin')
const { setup } = require('@ecomplus/application-sdk')
const pgClient = require('./client')
const { paymentStatus } = require('./utils')

const listStoreIds = () => {
  const storeIds = []
  const date = new Date()
  date.setHours(date.getHours() - 24)

  return firestore()
    .collection('ecomplus_app_auth')
    .where('updated_at', '>', firestore.Timestamp.fromDate(date))
    .get().then(querySnapshot => {
      querySnapshot.forEach(documentSnapshot => {
        const storeId = documentSnapshot.get('store_id')
        if (storeIds.indexOf(storeId) === -1) {
          storeIds.push(storeId)
        }
      })
      return storeIds
    })
}

const checkTransactions = ({ appSdk, storeId }) => {
  const date = new Date()
  date.setDate(date.getDate() - 7)
  const url = 'orders.json?fields=_id,transactions,payments_history,financial_status' +
    '&transactions.app.intermediator.code=pagseguro' +
    `&created_at>=${date.toISOString()}` +
    '&sort=financial_status.updated_at' +
    '&limit=20'

  return appSdk.apiRequest(storeId, url).then(({ response }) => {
    const { result } = response.data
    const checkRecur = (data, queue = 0) => {
      const nextOrder = () => {
        queue++
        checkRecur(data, queue)
      }

      if (!data[queue]) {
        return Promise.resolve()
      }

      const order = data[queue]

      if (order.financial_status && order.financial_status.current && order.transactions) {
        const transaction = order.transactions.find(transaction => transaction.intermediator && transaction.intermediator.transaction_code)
        if (transaction) {
          return pgClient({
            url: `/v3/transactions/${transaction.intermediator.transaction_code}`
          }, true).then(resp => {
            const pgTransaction = resp.transaction
            const { current } = order.financial_status
            const newStatus = paymentStatus(Number(pgTransaction.status))
            if (newStatus !== current) {
              const url = `orders/${order._id}/payments_history.json`
              return appSdk.apiRequest(storeId, url, 'post', {
                transaction_id: transaction._id,
                date_time: new Date().toISOString(),
                status: newStatus,
                flags: ['pgseguro:updater']
              }).then(() => ({
                storeId,
                order: order._id,
                status: newStatus
              })).catch(err => {
                console.error(`> PagSeguroOrderUpdaterError: order #${order._id}`, err)
                nextOrder()
              })
            } else {
              return nextOrder()
            }
          }).catch(err => {
            // next order
            const { response } = err
            if (response.status !== 404) {
              const { headers, data } = response
              const { message } = err
              let failed = {
                message,
                data
              }

              if (data && typeof data === 'string' && headers['content-type'] === 'application/xml;charset=ISO-8859-1') {
                try {
                  const error = JSON.parse(xmlToJSON.toJson(data))
                  failed.pagseguroError = error
                } catch (error) {
                  // igy igy 
                }
              }

              console.error('[TransactionsUpdaterFailed]:', JSON.stringify(failed, undefined, 4))
            }
            nextOrder()
          })
        } else {
          nextOrder()
        }
      } else {
        nextOrder()
      }
    }

    return checkRecur(result)
  })
}

module.exports = context => setup(null, true, firestore()).then(appSdk => {
  console.log('Cron Start')
  return listStoreIds().then(storeIds => {
    const runAllStores = fn => storeIds
      .sort(() => Math.random() - Math.random())
      .map(storeId => fn({ appSdk, storeId }))
    return Promise.all(runAllStores(checkTransactions))
  }).then(result => console.log('Cron Updater', result))
}).catch(console.error)