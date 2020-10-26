const xmlToJSON = require('xml2json')
const newTransaction = require('../../../lib/pagseguro/new-transaction')
const pgClient = require('./../../../lib/pagseguro/client')
const pgGetAuth = require('./../../../lib/pagseguro/get-auth')
const pgGetInstallments = require('./../../../lib/pagseguro/fetch-installments')
const { convertDate, paymentStatus, trimString } = require('./../../../lib/pagseguro/utils')
const jstoXML = require('../../../lib/pagseguro/js-to-xml')

exports.post = ({ admin }, req, res) => {
  const { params } = req.body
  const storeId = req.storeId
  console.log(`Transaction #${storeId} ${params.order_number}`)

  const doPayment = async ({ authorizationCode }) => {
    const transaction = newTransaction(params)
    let payment
    let installmentsValue
    // choice payment method
    switch (params.payment_method.code) {
      // mount data for payment with credit card
      case 'credit_card':
        const address = params.to || params.billing_address
        const hashs = params.credit_card.hash.split(' // ')
        const installmentsNumber = params.installments_number
        const amountTotal = parseInt(params.amount.total * 1000, 10) / 1000

        if (installmentsNumber > 1) {
          let installmentOptions

          try {
            installmentOptions = await pgClient({
              url: '/v2/sessions',
              authorizationCode,
              method: 'post'
            }, true)
              .then(({ session }) => {
                const { id } = session
                return pgGetInstallments(id, params.amount.total).then(({ data }) => data)
              })
          } catch (e) {
            // ignore
          }

          let installment
          if (installmentOptions) {
            installment = installmentOptions.installments.visa
              .find(option => option.quantity === installmentsNumber)
          }
          if (!installment) {
            if (hashs[2]) {
              try {
                installment = JSON.parse(hashs[2])
                  .find(option => option.quantity === installmentsNumber)
              } catch (e) {
                // ignore invalid json
                installment = null
              }
            }
          }
          if (installment && installment.totalAmount) {
            installmentsValue = {
              total: installment.totalAmount,
              value: installment.installmentAmount,
              tax: (!installment.interestFree)
            }
          }
        }

        if (!installmentsValue || !installmentsValue.value) {
          // default installments interest free
          installmentsValue = {
            total: amountTotal,
            value: amountTotal / installmentsNumber,
            tax: false
          }
        }

        payment = {
          ...transaction,
          mode: 'default',
          method: 'creditCard',
          creditCard: {
            token: hashs[1],
            installment: {
              quantity: params.installments_number,
              value: parseFloat(
                (installmentsValue && installmentsValue.value) ||
                amountTotal
              ).toFixed(2)
            },
            holder: {
              name: params.credit_card.holder_name,
              documents: {
                document: {
                  type: params.buyer.registry_type === 'p' ? 'CPF' : 'CNPJ',
                  value: params.buyer.doc_number
                }
              },
              birthDate: convertDate(
                params.buyer.birth_date.day,
                params.buyer.birth_date.month,
                params.buyer.birth_date.year
              ),
              phone: {
                areaCode: params.buyer.phone.number.substr(0, 2),
                number: params.buyer.phone.number.substr(2, params.buyer.phone.number)
              }
            },
            billingAddress: {
              street: trimString(address.street),
              number: address.number || 'SN',
              district: address.borough || '',
              city: address.city,
              state: address.province_code,
              country: 'BRA',
              postalCode: address.zip
            }
          }
        }

        if (payment.sender && hashs[0]) {
          payment.sender.hash = hashs[0]
        }

        break
      case 'banking_billet':
        payment = {
          mode: 'default',
          method: 'boleto',
          ...transaction
        }
        break
      case 'online_debit':
        payment = {
          mode: 'default',
          method: 'eft',
          bank: {
            name: 'itau'
          },
          ...transaction
        }
        break
      default: break
    }

    let xml = '<?xml version="1.0" encoding="ISO-8859-1" standalone="yes"?>'
    xml += jstoXML({ payment })

    const { Timestamp } = require('firebase-admin').firestore

    const saveTransaction = (code, status) => admin.firestore()
      .collection('pagseguro_transactions')
      .doc(code)
      .set({
        transaction_order_number: params.order_number,
        transaction_code: code,
        transaction_status: parseInt(status, 10),
        transaction_store_id: storeId,
        created_at: Timestamp.now(),
        updated_at: new Timestamp(1500000000, 0)
      })

    return pgClient({
      url: '/v2/transactions',
      method: 'post',
      data: xml,
      authorizationCode
    }, true).then(({ transaction }) => {
      let response
      switch (params.payment_method.code) {
        case 'credit_card':
          response = {
            'redirect_to_payment': false,
            'transaction': {
              'amount': Number(transaction.grossAmount),
              'creditor_fees': {
                'installment': Number(transaction.installmentCount),
                'intermediation': Number(transaction.feeAmount)
              },
              'currency_id': 'BRL',
              'installments': {
                'number': Number(transaction.installmentCount),
                'tax': installmentsValue.tax,
                'total': installmentsValue.total,
                'value': installmentsValue.value
              },
              'intermediator': {
                'payment_method': {
                  'code': 'credit_card',
                  'name': 'Cartão de Crédito'
                },
                'transaction_id': transaction.code,
                'transaction_code': transaction.code,
                'transaction_reference': transaction.reference
              },
              'status': {
                'current': paymentStatus(transaction.status)
              }
            }
          }
          break
        case 'online_debit':
          response = {
            'redirect_to_payment': false,
            'transaction': {
              'amount': Number(transaction.grossAmount),
              'payment_link': transaction.paymentLink,
              'currency_id': 'BRL',
              'intermediator': {
                'payment_method': {
                  'code': 'online_debit',
                  'name': 'Débito Online'
                },
                'transaction_id': transaction.code,
                'transaction_code': transaction.code,
                'transaction_reference': transaction.reference
              },
              'payment_link': transaction.paymentLink,
              'status': {
                'current': paymentStatus(transaction.status)
              }
            }
          }
          break
        case 'banking_billet':
          response = {
            'redirect_to_payment': false,
            'transaction': {
              'amount': Number(transaction.grossAmount),
              'banking_billet': {
                'link': transaction.paymentLink,
              },
              'creditor_fees': {
                'installment': parseInt(transaction.installmentCount),
                'intermediation': Number(transaction.grossAmount)
              },
              'currency_id': 'BRL',
              'installments': {
                'number': parseInt(transaction.installmentCount)
              },
              'intermediator': {
                'payment_method': {
                  'code': 'banking_billet',
                  'name': 'Boleto'
                },
                'transaction_id': transaction.code,
                'transaction_code': transaction.code,
                'transaction_reference': transaction.reference
              },
              'payment_link': transaction.paymentLink,
              'status': {
                'current': paymentStatus(transaction.status)
              }
            }
          }
          break
        default: break
      }

      return saveTransaction(transaction.code, transaction.status).then(() => res.send(response))
    })
  }

  return pgGetAuth({ storeId, admin }).then(doPayment)
    .catch(err => {
      console.log(err)
      let message = err.message
      if (err.name === 'AuthNotFound') {
        return res.status(409).send({
          error: 'AUTH_ERROR',
          message: 'Autenticação não encontrada. Aplicativo não foi instalado corretamente.'
        })
      } else {
        const { status, headers } = err.response
        console.log(`PagSeguro ${status} response for #${storeId} ${params.order_number}`)
        // treat some PagSeguro response status
        if (status === 403 || status >= 500) {
          res.status(status || 403).send({
            error: 'CREATE_TRANSACTION_PS_ERR',
            message: 'PagSeguro seems to be offline, try again later'
          })
        } else if (status === 401) {
          res.status(401).send({
            error: 'TRANSACTION_PS_AUTH_ERR',
            message: 'PagSeguro authentication error, please try another playment method'
          })
        } else if (status === 400) {
          if (headers['content-type'] === 'application/xml;charset=ISO-8859-1' &&
            (err.response && err.response.data) &&
            typeof err.response.data === 'string') {
            const error = JSON.parse(xmlToJSON.toJson(err.response.data))

            const { errors } = error
            if (errors && errors.error) {
              if (Array.isArray(errors.error)) {
                message = ''
                errors.error.forEach(e => {
                  message += `${e.message} | `
                })
              } else {
                message = errors.error.message
              }
            }

            err.pagseguroErrorJSON = error
            res.status(400).send({
              error: 'CREATE_TRANSACTION_ERR',
              message,
              errors
            })
          }
        }

        // debug axios request error stack
        err.storeId = storeId
        err.orderNumber = params.order_number
        return console.error(err)
      }
    })
}
