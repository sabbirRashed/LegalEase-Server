const express = require('express');
const cors = require('cors')
const app = express();
require('dotenv').config()

const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = process.env.MONGODB_URI
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json())


const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        await client.connect();

        const db = client.db('LegalEase');
        const userCollection = db.collection('user')
        const commentsCollection = db.collection('comments');
        const lawyerProfileCollection = db.collection('lawyerProfiles')

        app.get('/api/users', async(req, res,)=>{

        })

        app.post('/api/comments', async(req, res)=>{
            
        })

        // lawyer related api
        app.get('/api/lawyer/:id', async(req, res)=>{
            const id = req.params.id;
            const result = await lawyerProfileCollection.findOne({userId:id})
            console.log('user id:', result);
            res.send(result);
            
        })

        app.post('/api/lawyer', async(req, res)=>{

            const profileData = req.body;
            console.log('profile Data: ', profileData);
            const result = await lawyerProfileCollection.insertOne(profileData);
            console.log('result,', result);
            res.send(result || {})
        })

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");

    } finally {
        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.listen(port, () => {
    console.log(`LegalEase is listening on port ${port}`)
})