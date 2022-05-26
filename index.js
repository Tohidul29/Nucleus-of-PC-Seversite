const express = require('express');
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.z2iez.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next){
    const authHeader = req.headers.authorization;
    if(!authHeader){
        return res.status(401).send({message: 'Unauthorized access'});
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function(err, decoded){
        if(err){
            return res.status(403).send({message: 'Forbidden Access'})
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

        //get all tools:
        app.get('/tools', async (req, res) => {
            const query = {};
            const cursor = toolsCollection.find(query);
            const tools = await cursor.toArray();
            res.send(tools);
        })

        app.get('/user', async(req,res)=>{
            const user = await userCollection.find().toArray();
            res.send(user);
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
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '2h'})
            res.send({result, token});
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
            if(email === decodedEmail){
                const query = { buyerEmail: email };
                const order = await purchaseCollection.find(query).toArray();
                return res.send(order);
            }
            else{
                return res.status(403).send({message: 'Forbidden Access'});
            }
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