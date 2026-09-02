const express = require('express');
const cors = require('cors')
const app = express();
require('dotenv').config()

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
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
        const commentsCollection = db.collection('comments');
        const lawyerProfileCollection = db.collection('lawyerProfiles');
        const servicesCollection = db.collection('services');
        const requestCollection = db.collection('hiringRequest');


        app.post('/api/comments', async (req, res) => {

        })


        // lawyer related api
        app.get('/api/lawyer', async (req, res) => {
            const query = {}

            if (req.query.search) {
                query.$or = [
                    { name: { $regex: req.query.search, $options: 'i' } },
                    { specialization: { $regex: req.query.search, $options: 'i' } },
                ]
            }

            if (req.query.minFee || req.query.maxFee) {
                query.hourlyRate = {}

                if (req.query.minFee) {
                    query.hourlyRate.$gte = Number(req.query.minFee)
                }
                if (req.query.maxFee) {
                    query.hourlyRate.$lte = Number(req.query.maxFee)
                }
            }

            if (req.query.status) {
                query.status = req.query.status;
            }

            // Query for lawyer Id

            const cursor = lawyerProfileCollection.find(query)
            const result = await cursor.toArray();
            res.send(result);
        })

        app.get('/api/lawyer/myprofile', async (req, res) => {

            const query = {}

            if (req.query.userId) {
                query.userId = req.query.userId
            }

            const result = await lawyerProfileCollection.findOne(query)
            res.send(result || {})

        })

        app.get('/api/lawyer/:id', async (req, res) => {
            const id = req.params.id;
            const filter = {
                _id: new ObjectId(id),
            }

            const result = await lawyerProfileCollection.findOne(filter);
            res.send(result);
        })

        app.post('/api/lawyer', async (req, res) => {

            const profileData = req.body;
            const finalData = {
                ...profileData,
                createAt: new Date()
            }
            const result = await lawyerProfileCollection.insertOne(finalData);
            res.send(result || {})
        })

        app.patch('/api/lawyer/:id', async (req, res) => {
            const id = req.params.id;

            const find = {
                _id: new ObjectId(id)
            };

            const newData = req.body;
            const updatedData = {
                $set: newData
            }
            const result = await lawyerProfileCollection.updateOne(find, updatedData)
            console.log(find, updatedData, 'result:', result);
            res.send(result);

        })


        //  SERVICE RELATED API
        app.get('/api/service/:profileId', async (req, res) => {

            const profileId = req.params.profileId;
            const result = await servicesCollection.find({ profileId: profileId }).toArray();
            res.send(result);
        })

        app.post('/api/service', async (req, res) => {
            const data = req.body;

            const serviceData = {
                ...data,
                createAt: new Date()
            };

            const result = await servicesCollection.insertOne(serviceData)
            res.send(result || {});
        })

        app.patch("/api/service/:id", async (req, res) => {
            const id = req.params.id;

            const filter = {
                _id: new ObjectId(id)
            };
            const updatedService = req.body;

            const query = {
                $set: {
                    ...updatedService
                }
            }

            const result = await servicesCollection.updateOne(filter, query);
            res.send(result);
        })

        app.delete("/api/service/:id", async (req, res) => {
            const id = req.params.id;

            const filter = {
                _id: new ObjectId(id)
            }
            const result = await servicesCollection.deleteOne(filter);
            res.send(result)
        })



        // Hiring Request Related API
        app.get('/api/request/:clientId', async (req, res) => {
            const id = req.params.lawyerId;
            const filter = {
                clientUserId: id,
            }
            const cursor = requestCollection.find(filter);
            const result = await cursor.toArray();
            res.send(result)
        })

        app.get('/api/request/:lawyerId', async (req, res) => {
            const id = req.params.lawyerId;
            const filter = {
                lawyerProfileId: id,
            }

            const cursor = requestCollection.find(filter);
            const result = await cursor.toArray();
            res.send(result)
        })

        app.post("/api/request", async (req, res) => {

            const requestData = req.body;
            const dataWithData = {
                ...requestData,
                createAt: new Date(),
            }
            const result = await requestCollection.insertOne(dataWithData);
            res.send(result)
        })

        app.patch('/api/request/:id', async (req, res) => {
            const id = req.params.id;
            const updatedData = req.body;

            const filter = {
                _id: new ObjectId(id)
            }

            const query = {
                $set: {
                    status: updatedData?.status
                }
            }

            console.log('filter:', filter, "data:", query);
            const result = await requestCollection.updateOne(filter, query);
            console.log('up sta', result)
            res.send(result);

        })


        // COMMENT RELATED API
        app.get('/api/comments/:profileId', async (req, res) => {
            const profileId = req.params.profileId;
            const result = await commentsCollection.find({ lawyerProfileId: profileId }).toArray();
            res.send(result);
        })

        app.get('/api/comments/userId', async (req, res) => {
            const id = req.params.userId;
            const result = await commentsCollection({ clientUserId: id }).toArray();
            res.send(result)
        })


        app.post('/api/comment', async (req, res) => {
            const commentData = req.body;

            const finalData = {
                ...commentData,
                createAt: new Date(),
            }
            const result = await commentsCollection.insertOne(finalData);
            res.send(result);
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