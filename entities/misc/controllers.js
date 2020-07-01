import { GraphQLClient, request } from 'graphql-request'

import stripe from '../../lib/stripe'
import { isObjectValid } from '../../utils'

const dailycloak_client = new GraphQLClient(process.env.DAILYCLOAK_URL, {
   headers: {
      'x-hasura-admin-secret': `${process.env.DAILYCLOAK_ADMIN_SECRET}`,
   },
})

const UPDATE_ORG = `
   mutation updateOrganization(
      $id: Int!
      $_set: organization_organization_set_input!
   ) {
      updateOrganization(pk_columns: { id: $id }, _set: $_set) {
         id
      }
   }
`

export const getAccountId = async (req, res) => {
   try {
      const { org_id, code } = req.query
      const { stripe_user_id } = await stripe.oauth.token({
         code,
         grant_type: 'authorization_code',
      })
      console.log('getAccountId -> stripe_user_id', stripe_user_id)

      await dailycloak_client.request(UPDATE_ORG, {
         id: org_id,
         _set: {
            stripeAccountId: stripe_user_id,
         },
      })

      return res.json({
         success: true,
         data: { stripeAccountId: stripe_user_id },
      })
   } catch (error) {
      console.log('getAccountId -> error', error)
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
      'x-hasura-admin-secret': `${process.env.KEYCLOAK_ADMIN_SECRET}`,
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
      const data = await dailycloak_client(FETCH_ORG, {
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
   mutation platform_createCustomer($email: String!, $keycloakId: String!, $stripeCustomerId: String!) {
      platform_createCustomer(object: {email: $email, keycloakId: $keycloakId, stripeCustomerId: $stripeCustomerId}) {
         keycloakId
      }
   }
`

export const createCustomer = async (req, res) => {
   try {
      const { email, id, realm_id } = req.body.event.data.new
      if (!email) {
         throw Error('Email is missing!')
      }
      if (realm_id === 'consumers') {
         const customer = await stripe.customers.create({ email })
         const data = await client.request(CREATE_CUSTOMER, {
            email,
            keycloakId: id,
            stripeCustomerId: customer.id,
         })

         return res.status(200).json({ success: true, data })
      }
   } catch (error) {
      return res.status(404).json({ success: false, error: error.message })
   }
}
