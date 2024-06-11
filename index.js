const express = require('express');
const cors = require('cors');
require('dotenv').config();

const port = process.env.PORT | 5000;
const app = express();

// middleware

app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@bristobossdb.jmr3uxk.mongodb.net/?retryWrites=true&w=majority&appName=BristoBossDB`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const menuCollection = client.db('BistroBossDb').collection('Menu');
    const reviewCollection = client.db('BistroBossDb').collection('Reviws');
    const cartsCollection = client.db('BistroBossDb').collection('cartItems');
    const userCollection = client.db('BistroBossDb').collection('AllUsers');

    // ----------------users related apis--------------------

    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      console.log(filter);

      const updatedDoc = {
        $set: {
          role: 'admin',
        },
      };
      const result = await userCollection.updateOne(filter, updatedDoc);
      console.log(result);
      res.send(result);
    });

    // get all users
    app.get('/users', async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.delete('/users/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    app.post('/users', async (req, res) => {
      const user = req.body;
      // if user exist then don't allow to send in db and if not then send to db

      const query = { email: user.email };
      const existUser = await userCollection.findOne(query);
      if (existUser) {
        return res.send({ message: 'User Already Exist', insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // ----------menu and reviews related api----------------
    app.get('/menu', async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result);
    });

    app.get('/reviews', async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    });

    // -----------add to cart and user related api------------

    // get carts full specific user

    app.get('/carts', async (req, res) => {
      // for getting specific person data
      const email = req.query.email;
      const query = { email: email };
      // need to do this  from above
      const result = await cartsCollection.find(query).toArray();
      res.send(result);
    });

    // send data to carts api
    app.post('/carts', async (req, res) => {
      const cartItem = req.body;
      console.log('new cart added', cartItem);
      const result = await cartsCollection.insertOne(cartItem);
      res.send(result);
    });

    // delete from card
    app.delete('/carts/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const result = await cartsCollection.deleteOne(query);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 });
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

// starting

app.get('/', (req, res) => {
  res.send('Bistro Boss Server Is Running');
});

app.listen(port, () => {
  console.log(`Bistro Boss is Running at : ${port}`);
});
