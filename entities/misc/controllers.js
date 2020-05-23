import axios from 'axios'
import stripe from '../../lib/stripe'
import { request } from 'graphql-request'
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

const FETCH_ORG_FROM_HOSTNAME = `
   query organizations($organizationUrl: String_comparison_exp, $publicIp: String_comparison_exp, $instanceUrl: String_comparison_exp) {
      organizations(where: 
            {
               _or: 
                  [
                     {organizationUrl: $organizationUrl}, 
                     {instances: {publicIp: $publicIp}}, 
                     {instances: {instanceUrl: $instanceUrl}}
                  ]
               }
            ) {
         realm {
            dailyKeyClientId
         }
      }
   }
`

const CREATE_CUSTOMER_BY_CLIENT = `
   mutation createCustomerByClient($clientId: String!, $keycloakId: String!) {
      createCustomerByClient(object: {clientId: $clientId, keycloakId: $keycloakId}) {
         clientId
         keycloakId
      }
   } 
`

export const createCustomerByClient = async (req, res) => {
   try {
      const { keycloakId } = req.body.event.new

      // fetch client id
      const data = await request(
         process.env.DAILYCLOAK_URL,
         FETCH_ORG_FROM_HOSTNAME,
         {
            instanceUrl: { _eq: req.hostname },
            organizationUrl: { _eq: req.hostname },
            publicIp: { _eq: req.hostname },
         }
      )
      const clientId = await data.organizations.realm.dailyKeyClientId

      // create customer by client
      await request(
         process.env.HASURA_KEYCLOAK_URL,
         CREATE_CUSTOMER_BY_CLIENT,
         {
            clientId,
            keycloakId,
         }
      )
      return res.json({ success: true, message: 'Successfully created!' })
   } catch (error) {
      return res.json({ success: false, error: error.message })
   }
}

export const authorizeRequest = async (req, res) => {
   try {
      // fetch client id
      const data = await request(
         process.env.DAILYCLOAK_URL,
         FETCH_ORG_FROM_HOSTNAME,
         {
            instanceUrl: { _eq: req.hostname },
            organizationUrl: { _eq: req.hostname },
            publicIp: { _eq: req.hostname },
         }
      )
      const clientId = await data.organizations.realm.dailyKeyClientId

      return res.json({
         'X-Hasura-User-Id': clientId,
         'X-Hasura-Role': 'limited',
      })
   } catch (error) {
      return res.json({ success: false, error: error.message })
   }
}
