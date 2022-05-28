const express = require('express');
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.z2iez.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'Unauthorized access' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden Access' })
        }
        req.decoded = decoded;
        next();
        console.log(decoded)
    })
}

async function run() {
    try {
        await client.connect();
        const toolsCollection = client.db('Nucleus_of_PC').collection('tools');
        const purchaseCollection = client.db('Nucleus_of_PC').collection('purchase');
        const userCollection = client.db('Nucleus_of_PC').collection('users');
        const userReview = client.db('Nucleus_of_PC').collection('reviews');
        const paymentCollection = client.db('Nucleus_of_PC').collection('payments');

        //get all tools:
        app.get('/tools', async (req, res) => {
            const query = {};
            const cursor = toolsCollection.find(query);
            const tools = await cursor.toArray();
            res.send(tools);
        })

        app.get('/bookings', async (req, res) => {
            const query = {};
            const cursor = purchaseCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        });

        //delete a single tool from collection:
        app.delete('/tools/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await toolsCollection.deleteOne(query);
            res.send(result);
        })

        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const productPurchase = req.body;
            const productCost = productPurchase.productCost;
            const amount = productCost * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({ clientSecret: paymentIntent.client_secret })
        })

        //update a product stock
        app.put('/tools/:id', async (req, res) => {
            const id = req.params.id;
            const updatedItem = req.body;
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updatedDoc = {
                $set: updatedItem
            };
            const result = await toolsCollection.updateOne(filter, updatedDoc, options);
            res.send(result);
        })

        //get user reviews from DB:
        app.get('/reviews', async (req, res) => {
            const query = {};
            const cursor = userReview.find(query);
            const reviews = await cursor.toArray();
            res.send(reviews);
        })

        app.post('/tools', async (req, res) => {
            const purchase = req.body;
            const output = await toolsCollection.insertOne(purchase);
            res.send(output);
        })

        app.post('/reviews', async (req, res) => {
            const review = req.body;
            const result = await userReview.insertOne(review);
            res.send(result);
        })

        //get user from DB:
        app.get('/user', verifyJWT, async (req, res) => {
            const user = await userCollection.find().toArray();
            res.send(user);
        })

        //get admin from DB query via email and role:
        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email });
            const isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin });
        })

        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '2h' })
            res.send({ result, token });
        })

        app.put('/user/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const requesterUser = req.decoded.email;
            const requesterUserAccount = await userCollection.findOne({ email: requesterUser });
            if (requesterUserAccount.role === 'admin') {
                const filter = { email: email };
                const updateDoc = {
                    $set: { role: 'admin' },
                };
                const result = await userCollection.updateOne(filter, updateDoc);
                res.send(result);
            }
            else {
                res.status(403).send({ message: 'forbidden access' });
            }
        })

        // load single tool
        app.get('/tools/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const tool = await toolsCollection.findOne(query);
            res.send(tool);
        });

        //for submit users purchase product:
        app.post('/purchase', async (req, res) => {
            const purchase = req.body;
            const output = await purchaseCollection.insertOne(purchase);
            res.send(output);
        })

        //get users product details:
        app.get('/purchase', verifyJWT, async (req, res) => {
            const email = req.query.buyerEmail;
            const decodedEmail = req.decoded.email;
            if (email === decodedEmail) {
                const query = { buyerEmail: email };
                const order = await purchaseCollection.find(query).toArray();
                return res.send(order);
            }
            else {
                return res.status(403).send({ message: 'Forbidden Access' });
            }
        })

        app.get('/purchase/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const purchase = await purchaseCollection.findOne(query);
            res.send(purchase);
        })

        app.patch('/purchase/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const payment = req.body;
            const filter = { _id: ObjectId(id) };
            const updatedDoc = {
                $set: {
                    paid: true,
                    transectionId: payment.transectionId
                }
            }
            const result = await paymentCollection.insertOne(payment);
            const updatedPurchase = await purchaseCollection.updateOne(filter, updatedDoc);
            res.send(updatedDoc);
        })

    }
    finally {

    }
}

run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Nucleus of PC is running');
})

app.listen(port, () => {
    console.log(`listing to the port ${port}`);
})