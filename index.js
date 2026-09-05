const express = require('express');
const cors = require('cors')
const app = express();
require('dotenv').config()

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { createRemoteJWKSet, jwtVerify } = require('jose-cjs');
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

// middle ware JWT
const JWKS = createRemoteJWKSet(
    new URL(`http://localhost:3000/api/auth/jwks`)
);


const verifyToken = async (req, res, next) => {
    const authHeader = req?.headers?.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'Unauthorized' });
    }
    const token = authHeader.split(" ")[1]
    if (!token) {
        return res.status(401).send({ message: 'Unauthorized' })
    }

    console.log('token', token);
    try {
        const { payload } = await jwtVerify(token, JWKS);
        req.user = payload
        next()
    }
    catch (error) {
        return res.status(403).send({ message: "Forbidden" })
    }
}

const verifyUser = async (req, res, next) => {
    if (req?.user?.role !== "user") {
        return res.status(403).send({ message: "forbidden access" });
    }

    next()
}


const verifyLawyer = async (req, res, next) => {
    if (req?.user?.role !== "lawyer") {
        return res.status(403).send({ message: "forbidden access" });
    }

    next()
}

const verifyAdmin = async (req, res, next) => {
    if (req?.user?.role !== "admin") {
        return res.status(403).send({ message: "forbidden access" });
    }

    next()
}

async function run() {
    try {
        await client.connect();

        const db = client.db('LegalEase');
        const usersCollection = db.collection("user")
        const commentsCollection = db.collection('comments');
        const lawyerProfileCollection = db.collection('lawyerProfiles');
        const servicesCollection = db.collection('services');
        const requestCollection = db.collection('hiringRequest');
        const transactionCollection = db.collection('transaction');

        // User related api
        app.get("/api/users", verifyToken, verifyAdmin, async (req, res) => {

            const totalUsers = await usersCollection.countDocuments();
            const totalClients = await usersCollection.countDocuments({ role: "user" });
            const totalLawyers = await usersCollection.countDocuments({ role: "lawyer" });
            const totalAdmins = await usersCollection.countDocuments({ role: "admin" });
            const users = await usersCollection.find().toArray();
            res.send({ totalUsers, totalClients, totalLawyers, totalAdmins, users });
        })

        app.patch('/api/user/:id', verifyToken, verifyAdmin, async (req, res) => {
            const userId = req.params.id;
            const data = req.body;

            const filter = {
                _id: new ObjectId(userId)
            }
            const query = {
                $set: {
                    role: data?.role
                }
            }
            const result = await usersCollection.updateOne(filter, query);
            res.send(result)
        })

        app.delete('/api/user/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = {
                _id: new ObjectId(id)
            };
            const result = await usersCollection.deleteOne(filter);
            console.log('del:', result);
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

            if (req.query.page) {
                const page = req.query.page
                const perPage = req.query.perPage || 12;
                const skipProfile = (page - 1) * perPage;

                const total = await lawyerProfileCollection.countDocuments(query)

                const cursor = lawyerProfileCollection.find(query).skip(skipProfile).limit(perPage);
                const profiles = await cursor.toArray();
                return res.send({ total, profiles });

            }

            const cursor = lawyerProfileCollection.find(query)
            const profiles = await cursor.toArray();
            res.send({ profiles });
        })

        app.get('/api/lawyer/myprofile', verifyToken, async (req, res) => {

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

        app.get('/api/toplawyers', async (req, res) => {
            const cursor = lawyerProfileCollection.find().sort({ hireCount: -1 }).limit(3);
            const result = await cursor.toArray();

            res.send(result);
        })

        app.post('/api/lawyer', verifyToken, verifyLawyer, async (req, res) => {

            const profileData = req.body;
            const finalData = {
                ...profileData,
                hireCount: 0,
                createAt: new Date()
            }
            const result = await lawyerProfileCollection.insertOne(finalData);
            res.send(result || {})
        })

        app.patch('/api/lawyer/:id', verifyToken, verifyLawyer, async (req, res) => {
            const id = req.params.id;

            const find = {
                _id: new ObjectId(id)
            };

            const newData = req.body;
            const updatedData = {
                $set: newData
            }
            const result = await lawyerProfileCollection.updateOne(find, updatedData)
            res.send(result);

        })


        //  SERVICE RELATED API
        app.get('/api/service/:profileId', verifyToken, verifyLawyer, async (req, res) => {

            const profileId = req.params.profileId;
            const result = await servicesCollection.find({ profileId: profileId }).toArray();
            res.send(result);
        })

        app.post('/api/service', verifyToken, verifyLawyer, async (req, res) => {
            const data = req.body;

            const serviceData = {
                ...data,
                createAt: new Date()
            };

            const result = await servicesCollection.insertOne(serviceData)
            res.send(result || {});
        })

        app.patch("/api/service/:id", verifyToken, verifyLawyer, async (req, res) => {
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

        app.delete("/api/service/:id", verifyToken, verifyLawyer, async (req, res) => {
            const id = req.params.id;

            const filter = {
                _id: new ObjectId(id)
            }
            const result = await servicesCollection.deleteOne(filter);
            res.send(result)
        })


        // Hiring Request Related API
        app.get('/api/request/commentpermission', verifyToken, verifyUser, async (req, res) => {
            console.log('start permission');
            const { clientUserId, lawyerProfileId } = req.query;

            const query = {
                clientUserId,
                lawyerProfileId,
                status: "Accepted"
            };
            const result = await requestCollection.findOne(query);
            res.send(result || {})
        })

        app.get('/api/request/user/:clientId', verifyToken, verifyUser, async (req, res) => {
            const id = req.params.clientId;
            const filter = {
                clientUserId: id,
            }
            const cursor = requestCollection.find(filter);
            const result = await cursor.toArray();
            res.send(result)
        })

        app.get('/api/request/:lawyerId', verifyToken, verifyLawyer, async (req, res) => {
            const id = req.params.lawyerId;
            const filter = {
                lawyerProfileId: id,
            }

            const cursor = requestCollection.find(filter);
            const result = await cursor.toArray();
            res.send(result)
        })


        app.get('/api/request/requestid/:id', verifyToken, verifyUser, async (req, res) => {
            const id = req.params.id;
            const filter = {
                _id: new ObjectId(id)
            }
            const result = await requestCollection.findOne(filter);
            res.send(result);

        })

        app.post("/api/request", verifyToken, verifyUser, async (req, res) => {

            const requestData = req.body;
            const dataWithData = {
                ...requestData,
                createAt: new Date(),
            }
            const result = await requestCollection.insertOne(dataWithData);
            res.send(result)
        })

        app.patch('/api/request/:id', verifyToken, verifyLawyer, async (req, res) => {
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
            const result = await requestCollection.updateOne(filter, query);
            res.send(result);

        })


        // TRANSACTION RELATED API
        app.get('/api/transactions', verifyToken, verifyAdmin, async (req, res) => {

            const query = {}
            if (req.query.clientUserId) {
                query.clientUserId = req.query.clientUserId;
            }
            if (req.query.lawyerProfileId) {
                query.lawyerProfileId = req.query.lawyerProfileId;
            }

            const cursor = transactionCollection.find(query);
            const result = await cursor.toArray();
            res.send(result)
        })

        app.post('/api/transaction', verifyToken, verifyUser, async (req, res) => {
            const data = req.body;

            const dataWithTransactionId = {
                ...data,
                transactionId: `TXN-${Date.now()}`,
                createdAt: new Date()
            }

            // filter for update doc
            const filterReq = {
                _id: new ObjectId(dataWithTransactionId?.hiringRequestId),
            }
            const filterProfile = {
                _id: new ObjectId(dataWithTransactionId?.lawyerProfileId)
            }

            // set query for update
            const queryForReq = {
                $set: { paymentStatus: "Paid" }
            }
            const queryForProfile = {
                $inc: { hireCount: 1 }
            }

            const existingRequest = await requestCollection.findOne(filterReq);

            // update
            if (existingRequest?.paymentStatus !== "Paid") {
                await requestCollection.updateOne(filterReq, queryForReq)
                await lawyerProfileCollection.updateOne(filterProfile, queryForProfile)
            }

            const result = await transactionCollection.insertOne(dataWithTransactionId);
            res.send(result);
        })


        // COMMENT RELATED API
        app.get('/api/comments/:profileId', verifyToken, verifyUser, async (req, res) => {
            const profileId = req.params.profileId;
            const result = await commentsCollection.find({ lawyerProfileId: profileId }).toArray();
            res.send(result);
        })

        app.get('/api/comments/user/:userId', verifyToken, verifyUser, async (req, res) => {
            const id = req.params.userId;
            const result = await commentsCollection.find({ clientUserId: id }).toArray();
            res.send(result)
        })


        app.post('/api/comment', verifyToken, verifyUser, async (req, res) => {
            const commentData = req.body;

            const finalData = {
                ...commentData,
                createAt: new Date(),
            }
            const result = await commentsCollection.insertOne(finalData);
            res.send(result);
        })

        app.patch('/api/comment/:id', verifyToken, verifyUser, async (req, res) => {
            const id = req.params.id;

            const filter = {
                _id: new ObjectId(id)
            }
            const updatedComment = req.body;

            const query = {
                $set: {
                    comment: updatedComment?.comment
                }
            }

            const result = await commentsCollection.updateOne(filter, query);
            res.send(result)
        })

        app.delete("/api/comment/:id", verifyToken, verifyUser, async (req, res) => {
            const id = req.params.id;
            const filter = {
                _id: new ObjectId(id),
            }

            const result = await commentsCollection.deleteOne(filter);
            res.send(result);
        })


        app.get('/api/admin/analytics', verifyToken, verifyAdmin, async (req, res) => {
            const totalUsers = await usersCollection.countDocuments();
            const totalLawyers = await usersCollection.countDocuments({ role: "lawyer" });
            const totalHire = await requestCollection.countDocuments({ paymentStatus: "Paid" });
            const totalRevenueResult = await transactionCollection.aggregate([
                {
                    $match: {
                        paymentStatus: "Paid"
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: {
                            $sum: { $toDouble: "$amount" }
                        }
                    }
                }
            ]).toArray();

            const revenueResult = await transactionCollection.aggregate([
                {
                    $match: {
                        paymentStatus: "Paid"
                    }
                },
                {
                    $group: {
                        _id: {
                            $month: "$createAt"
                        },
                        revenue: {
                            $sum: { $toDouble: "$amount" }
                        }
                    }
                },
                {
                    $sort: {
                        _id: 1
                    }
                }
            ]).toArray();
            const totalRevenue = totalRevenueResult[0]?.total || 0;

            res.send({ totalUsers, totalLawyers, totalHire, totalRevenue, revenueResult })
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