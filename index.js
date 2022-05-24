const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.z2iez.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


async function run(){
    try{
        await client.connect();
        const toolsCollection = client.db('Nucleus_of_PC').collection('tools');

        //get all tools:
        app.get('/tools', async(req, res)=>{
            const query = {};
            const cursor = toolsCollection.find(query);
            const tools = await cursor.toArray();
            res.send(tools);
        })

        // load single tool
        app.get('/tools/:id', async(req, res)=>{
            const id = req.params.id;
            const query = {_id: ObjectId(id)};
            const tool = await toolsCollection.findOne(query);
            res.send(tool);
        })
    }
    finally{

    }
}

run().catch(console.dir);


app.get('/', (req, res)=>{
    res.send('Nucleus of PC is running');
})

app.listen(port, ()=>{
    console.log(`listing to the port ${port}`);
})