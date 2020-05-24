import stripe from '../../lib/stripe'
import { GraphQLClient, request } from 'graphql-request'
import { isObjectValid } from '../../utils'

export const getAccountId = async (req, res) => {
   try {
      const { code } = req.query
      const response = await stripe.oauth.token({
         code,
         grant_type: 'authorization_code',
      })
      const connected_account_id = await response.stripe_user_id

      return res.json({
         success: true,
         data: { stripeAccountId: connected_account_id },
      })
   } catch (error) {
      return res.json({ success: false, error: error.message })
   }
}

export const createLoginLink = async (req, res) => {
   try {
      const { accountId } = req.query
      const response = await stripe.accounts.createLoginLink(accountId)
      return res.json({
         success: true,
         data: { link: response },
      })
   } catch (error) {
      return res.json({ success: false, error: error.message })
   }
}

export const getBalance = async (req, res) => {
   try {
      const { accountId } = req.query
      const response = await stripe.balance.retrieve(null, {
         stripeAccount: accountId,
      })

      if (isObjectValid(response)) {
         return res.json({ success: true, data: response })
      } else {
         throw Error('Didnt get any response from Stripe!')
      }
   } catch (error) {
      return res.json({ success: false, error: error.message })
   }
}

const FETCH_ORG = `
   query organization($id: Int!){
      organization(id: $id) {
      realm {
         dailyKeyClientId
      }
      }
   } 
`

const CREATE_CUSTOMER_BY_CLIENT = `
   mutation platform_createCustomerByClient($clientId: String!, $keycloakId: String!) {
      platform_createCustomerByClient(object: {clientId: $clientId, keycloakId: $keycloakId}) {
         clientId
         keycloakId
      }
   } 
`
const client = new GraphQLClient(process.env.HASURA_KEYCLOAK_URL, {
   headers: {
      'x-hasura-admin-secret': `${process.env.ADMIN_SECRET}`,
   },
})

export const createCustomerByClient = async (req, res) => {
   try {
      const { clientId, keycloakId } = req.body.event.data.new

      // create customer by client
      await client.request(CREATE_CUSTOMER_BY_CLIENT, {
         clientId,
         keycloakId,
      })
      return res.json({ success: true, message: 'Successfully created!' })
   } catch (error) {
      return res.json({ success: false, error: error.message })
   }
}

export const authorizeRequest = async (req, res) => {
   try {
      const organizationId = req.body.headers['Organization-Id']

      // fetch client id
      const data = await request(process.env.DAILYCLOAK_URL, FETCH_ORG, {
         id: organizationId,
      })
      const clientId = await data.organization.realm.dailyKeyClientId

      return res.status(200).json({
         'X-Hasura-User-Id': clientId,
         'X-Hasura-Role': 'limited',
      })
   } catch (error) {
      return res.status(404).json({ success: false, error: error.message })
   }
}

const CREATE_CUSTOMER = `
   mutation platform_createCustomer($email: String!, $keycloakId: String!) {
      platform_createCustomer(object: {email: $email, keycloakId: $keycloakId}) {
         keycloakId
      }
   }
`

export const createCustomer = async (req, res) => {
   try {
      const { email, id, realm_id } = req.body.event.data.new
      if (realm_id === 'consumers') {
         const customer = await stripe.customers.create({ email })
         const data = await client.request(CREATE_CUSTOMER, {
            email,
            keycloakId: id,
            stripeCustomerId: customer.id,
         })

         return res.status(200).json({ success: true, data })
      }
      return res
         .status(403)
         .json({ success: false, message: "Request can't be processed!" })
   } catch (error) {
      return res.status(404).json({ success: false, error: error.message })
   }
}
