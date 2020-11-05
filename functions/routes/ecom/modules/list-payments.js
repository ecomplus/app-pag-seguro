const pgClient = require('./../../../lib/pagseguro/client')
const pgGetAuth = require('./../../../lib/pagseguro/get-auth')
const pgGetInstallments = require('./../../../lib/pagseguro/fetch-installments')
const { baseUri } = require('./../../../__env')

exports.post = ({ appSdk, admin }, req, res) => {
  const { storeId } = req
  // parse params from body
  const { params, application } = req.body

  const sendPaymentGateways = ({ session, installmentOptions }) => {
    console.log('sendPaymentGateways', new Date().toISOString())
    // app settings
    const config = Object.assign(application.data, application.hidden_data)

    // empty response
    const response = {
      payment_gateways: []
    }

    // calculate discount value
    const { discount } = config
    if (discount && discount.value > 0) {
      if (discount.apply_at !== 'freight') {
        // default discount option
        const { value } = discount
        response.discount_option = {
          label: config.discount_option_label,
          value
        }
          // specify the discount type and min amount is optional
          ;['type', 'min_amount'].forEach(prop => {
            if (discount[prop]) {
              response.discount_option[prop] = discount[prop]
            }
          })
      }
    }

    const mode = Boolean(process.env.PS_APP_SANDBOX) === true ? '-sandbox' : ''
    let onloadFunction = `window.pagseguroSessionId="${session}";`
    if (installmentOptions && installmentOptions.installments) {
      const installmentsJson = JSON.stringify(installmentOptions.installments.visa)
      if (installmentsJson.length > 50 && installmentsJson.length <= 1500) {
        onloadFunction += `window.pagseguroInstallments=${installmentsJson};`
      }
    }

    const installmentsOption = config.installments_option

    // credit_card
    if (!config.credit_card || !config.credit_card.disabled) {
      const creditCard = {
        ...newPaymentGateway(),
        payment_method: {
          code: 'credit_card',
          name: 'Cartão de crédito - pagseguro'
        },
        label: 'Cartão de crédito',
        installment_options: [],
        js_client: {
          cc_brand: {
            function: 'pagseguroBrand',
            is_promise: true
          },
          cc_hash: {
            function: 'pagseguroHash',
            is_promise: true
          },
          fallback_script_uri: `${baseUri}/fallback-pagseguro-dp${mode}.js`,
          onload_expression: onloadFunction,
          script_uri: `${baseUri}/pagseguro-dp${mode}.js`
        },
        icon: 'https://e-com.club/mass/ftp/others/pagseguro_credito.png',
        card_companies: config.card_companies
      }

      if (installmentOptions && installmentOptions.installments && installmentOptions.installments.visa) {
        const { visa } = installmentOptions.installments
        visa
          .filter(installment => installment.quantity > 1)
          .forEach(installment => {
            if (installmentsOption &&
              (installmentsOption.max_number < installment.quantity ||
                installmentsOption.min_installment &&
                installmentsOption.min_installment > Math.abs(installment.installmentAmount))) {
              return
            }

            creditCard.installment_options.push({
              number: installment.quantity,
              tax: (!installment.interestFree),
              value: Math.abs(installment.installmentAmount)
            })
          })
      }

      response.payment_gateways.push(creditCard)
    }

    // check if payment options are enabled before adding payment list
    // baking_billet
    if (!config.banking_billet || !config.banking_billet.disabled) {
      const bankingBillet = {
        ...newPaymentGateway(),
        payment_method: {
          code: 'banking_billet',
          name: 'Boleto Bancário'
        },
        label: 'Boleto Bancário',
        expiration_date: (config && config.banking_billet) ? config.banking_billet.expiration_date : undefined,
        instruction_lines: {
          first: 'Atenção',
          second: 'fique atento à data de vencimento do boleto.',
          third: 'Pague em qualquer casa lotérica.'
        },
        js_client: {
          transaction_promise: '_senderHash',
          onload_expression: onloadFunction,
          script_uri: `${baseUri}/pagseguro-dp${mode}.js`,
          fallback_script_uri: `${baseUri}/fallback-pagseguro-dp${mode}.js`
        }
      }

      if (discount && discount.value > 0) {
        bankingBillet.discount = discount
      }

      response.payment_gateways.push(bankingBillet)
    }

    // online_debit
    if (!config.online_debit || !config.online_debit.disabled) {
      const onlineDebit = {
        ...newPaymentGateway(),
        payment_method: {
          code: 'online_debit',
          name: 'Débito Online'
        },
        label: 'Débito Online',
        icon: 'https://e-com.club/mass/ftp/others/pagseguro_debito.png',
        js_client: {
          transaction_promise: '_senderHash',
          fallback_script_uri: `${baseUri}/fallback-pagseguro-dp${mode}.js`,
          onload_expression: onloadFunction,
          script_uri: `${baseUri}/pagseguro-dp${mode}.js`
        }
      }

      response.payment_gateways.push(onlineDebit)
    } else {
      // remove discount options from response
      delete response.discount_option
    }

    if (installmentsOption && installmentsOption.max_number) {
      response.installments_option = installmentsOption
    } else {
      //response.installments_option
      if (installmentOptions && installmentOptions.installments) {
        const installmentsOption = installmentOptions.installments.visa.find(option => option.interestFree === false)
        response.installments_option = {
          min_installment: installmentsOption.quantity,
          max_number: installmentOptions.installments.visa.length,
          monthly_interest: 0
        }
      }
    }
    console.log('response', new Date().toISOString())
    return res.send(response)
  }

  return pgGetAuth({ storeId, admin }).then(({ authorizationCode }) => {
    console.log('GetAuth', new Date().toISOString())
    if (params.is_checkout_confirmation) {
      console.log(`Checkout #${req.storeId}`)
      return sendPaymentGateways({})
    } else {
      return pgClient({
        url: '/v2/sessions',
        authorizationCode,
        method: 'post'
      }, true).then(data => {
        console.log('session', new Date().toISOString())
        const { session } = data
        if (params.amount && params.amount.total) {
          return pgGetInstallments(session.id, params.amount.total)
            .then(({ data }) => ({ session, installmentOptions: data }))
        }
        return { session, installmentOptions: undefined }
      })
        .then(({ session, installmentOptions }) => {
          console.log('getInstallments', new Date().toISOString())
          return sendPaymentGateways({ session: session.id, installmentOptions })
        })
    }
  }).catch(err => {
    if (err.name === 'AuthNotFound') {
      return res.status(409).send({
        error: 'AUTH_ERROR',
        message: 'Autenticação não encontrada. Aplicativo não foi instalado corretamente.'
      })
    } else {
      const { response, message } = err
      console.log(err)
      res.status(response && response.httpStatusCode || 400).send({
        error: 'UNABLE_TO_LIST_PAYMENTS',
        message: (response && response.error_description || response.data) || message
      })
    }
  })
}

const newPaymentGateway = () => {
  return {
    intermediator: {
      code: 'pagseguro',
      link: 'https://www.pagseguro.com.br',
      name: 'Pagseguro'
    },
    payment_url: 'https://www.pagseguro.com.br/',
    type: 'payment'
  }
}
