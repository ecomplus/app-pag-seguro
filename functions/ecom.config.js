/* eslint-disable comma-dangle, no-multi-spaces, key-spacing */

/**
 * Edit base E-Com Plus Application object here.
 * Ref.: https://developers.e-com.plus/docs/api/#/store/applications/
 */

const app = {
  app_id: 109126,
  title: 'Pagseguro',
  slug: 'pag-seguro',
  type: 'external',
  state: 'active',
  authentication: true,

  /**
   * Uncomment modules above to work with E-Com Plus Mods API on Storefront.
   * Ref.: https://developers.e-com.plus/modules-api/
   */
  modules: {
    /**
     * Triggered to calculate shipping options, must return values and deadlines.
     * Start editing `routes/ecom/modules/calculate-shipping.js`
     */
    // calculate_shipping:   { enabled: true },

    /**
     * Triggered to validate and apply discount value, must return discount and conditions.
     * Start editing `routes/ecom/modules/apply-discount.js`
     */
    // apply_discount:       { enabled: true },

    /**
     * Triggered when listing payments, must return available payment methods.
     * Start editing `routes/ecom/modules/list-payments.js`
     */
    list_payments: { enabled: true },

    /**
     * Triggered when order is being closed, must create payment transaction and return info.
     * Start editing `routes/ecom/modules/create-transaction.js`
     */
    create_transaction: { enabled: true },
  },

  /**
   * Uncomment only the resources/methods your app may need to consume through Store API.
   */
  auth_scope: {
    'stores/me': [
      'GET'            // Read store info
    ],
    procedures: [
      'POST'           // Create procedures to receive webhooks
    ],
    orders: [
      'GET',           // List/read orders with public and private fields
      'POST',          // Create orders
      // 'PATCH',         // Edit orders
      // 'PUT',           // Overwrite orders
      // 'DELETE',        // Delete orders
    ],
    'orders/payments_history': [
      'GET',           // List/read order payments history events
      'POST',          // Create payments history entry with new status
      'PATCH',        // Delete payments history entry
    ],
    'orders/hidden_metafields': [
      "POST"
    ]
  },

  admin_settings: {
    sort: {
      schema: {
        type: "string",
        title: "Ordem de pagamento",
        description: "Defina qual das modalidades de pagamento que irão aparecer primeiro no checkout.",
        enum: ["Débito online", "Cartão de crédito", "Boleto bancário"]
      },
      hide: false
    },
    credit_card: {
      schema: {
        type: "object",
        title: "Cartão de crédito",
        description: "Configurações para pagamento com cartão de crédito",
        properties: {
          disabled: {
            type: "boolean",
            title: "Desabilitar opção de pagamento",
            default: false
          },
          min_installment: {
            type: "number",
            minimum: 1,
            maximum: 99999999,
            default: 5,
            title: "Parcela mínima",
            description: "Valor mínimo da parcela"
          },
          max_number: {
            type: "integer",
            minimum: 2,
            maximum: 999,
            title: "Máximo de parcelas",
            description: "Número máximo de parcelas"
          },
          max_interest_free: {
            type: "integer",
            minimum: 2,
            maximum: 999,
            title: "Parcelas sem juros",
            description: "Parcelamento sem juros como configurado na conta PagSeguro"
          }
        }
      },
      hide: false
    },
    installments_option: {
      schema: {
        type: "object",
        required: ["max_number"],
        additionalProperties: false,
        properties: {
          min_installment: {
            type: "number",
            minimum: 1,
            maximum: 99999999,
            default: 5,
            title: "Parcela mínima",
            description: "Valor mínimo da parcela"
          },
          max_number: {
            type: "integer",
            minimum: 2,
            maximum: 999,
            title: "Máximo de parcelas",
            description: "Número máximo de parcelas (como configurado na conta do PagSeguro)"
          },
          monthly_interest: {
            type: "number",
            minimum: 0,
            maximum: 9999,
            default: 0,
            title: "Juros mensais",
            description: "Taxa de juros mensal, zero para parcelamento sem juros"
          }
        },
        title: "Parcelamento padrão",
        description: "Opção de parcelamento equivalente à configuração em sua conta do PagSeguro"
      },
      hide: false
    },
    online_debit: {
      schema: {
        type: "object",
        title: "Débito online",
        description: "Configurações para pagamento com débito online",
        properties: {
          disabled: {
            type: "boolean",
            title: "Desabilitar opção de pagamento",
            default: false
          }
        }
      },
      hide: false
    },
    banking_billet: {
      schema: {
        type: "object",
        title: "Boleto",
        description: "Configurações para pagamento com boleto",
        properties: {
          disabled: {
            type: "boolean",
            title: "Desabilitar opção de pagamento",
            default: false
          }
        }
      },
      hide: false
    },
    discount: {
      schema: {
        type: "object",
        required: ["value"],
        additionalProperties: false,
        properties: {
          apply_at: {
            type: "string",
            enum: ["total", "subtotal", "freight"],
            default: "subtotal",
            title: "Aplicar desconto em",
            description: "Em qual valor o desconto deverá ser aplicado no checkout"
          },
          min_amount: {
            type: "integer",
            minimum: 1,
            maximum: 999999999,
            description: "Montante mínimo para aplicar o desconto",
            title: "Valor mínimo"
          },
          type: {
            type: "string",
            enum: ["percentage", "fixed"],
            default: "percentage",
            title: "Tipo de desconto",
            description: "Desconto com valor percentual ou fixo"
          },
          value: {
            type: "number",
            minimum: -99999999,
            maximum: 99999999,
            title: "Valor do desconto",
            description: "Valor percentual ou fixo a ser descontado, dependendo to tipo configurado"
          }
        },
        title: "Desconto",
        description: "Desconto a ser aplicado para pagamentos realizados com boletos"
      },
      hide: false
    }
  }
}

/**
 * List of Procedures to be created on each store after app installation.
 * Ref.: https://developers.e-com.plus/docs/api/#/store/procedures/
 */

const procedures = []

/**
 * Uncomment and edit code above to configure `triggers` and receive respective `webhooks`:

const { baseUri } = require('./__env')

procedures.push({
  title: app.title,

  triggers: [
    // Receive notifications when new order is created:
    {
      resource: 'orders',
      action: 'create',
    },

    // Receive notifications when order financial/fulfillment status changes:
    {
      resource: 'orders',
      field: 'financial_status',
    },
    {
      resource: 'orders',
      field: 'fulfillment_status',
    },

    // Receive notifications when products/variations stock quantity changes:
    {
      resource: 'products',
      field: 'quantity',
    },
    {
      resource: 'products',
      subresource: 'variations',
      field: 'quantity'
    },

    // Receive notifications when cart is edited:
    {
      resource: 'carts',
      action: 'change',
    },

    // Receive notifications when customer is deleted:
    {
      resource: 'customers',
      action: 'delete',
    },

    // Feel free to create custom combinations with any Store API resource, subresource, action and field.
  ],

  webhooks: [
    {
      api: {
        external_api: {
          uri: `${baseUri}/ecom/webhook`
        }
      },
      method: 'POST'
    }
  ]
})

 * You may also edit `routes/ecom/webhook.js` to treat notifications properly.
 */

exports.app = app

exports.procedures = procedures
