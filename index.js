const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.Stripe_Secret_Key);

const port = process.env.PORT | 5000;
const app = express();

// middleware

app.use(cors());
app.use(express.json());

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
    const paymentDetailCollection = client
      .db('BistroBossDb')
      .collection('PaymentDetails');

    // middlewares for verify token second stem jwt
    const verifyToken = (req, res, next) => {
      // console.log('inside verify token', req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'Unauthorized Access' });
      }

      const token = req.headers.authorization.split(' ')[1];
      // console.log('token', token);
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'Unauthorized Access' });
        }
        req.decoded = decoded;
        next();
      });
    };

    // verify admin after token verify last step

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user.role == 'admin';
      if (!isAdmin) {
        return res.status(403).send({ message: 'Forbidden access' });
      }
      next();
    };

    // verify admin first step
    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'Forbidden access' });
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user.role === 'admin';
      }
      res.send({ admin });
    });

    // jwt implement first step

    app.post('/jwt', async (req, res) => {
      const user = req.body;

      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '1h',
      });
      res.send({ token });
    });

    // ----------------users related apis--------------------

    // get all users
    app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // update user for making admin

    app.patch(
      '/users/admin/:id',
      verifyToken,
      verifyAdmin,
      async (req, res) => {
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
      }
    );

    app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
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

    // post one data

    app.post('/menu', verifyToken, verifyAdmin, async (req, res) => {
      const menuItem = req.body;
      console.log(menuItem);
      const result = await menuCollection.insertOne(menuItem);
      res.send(result);
    });
    // update data

    app.get('/menu/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.findOne(query);
      res.send(result);
    });

    app.patch('/menu/:id', async (req, res) => {
      const item = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          name: item.name,
          category: item.category,
          price: item.price,
          recipe: item.recipe,
          image: item.image,
        },
      };

      const result = await menuCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // delete item form db menu

    app.delete('/menu/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      console.log('delete req id ', id);
      const query = { _id: new ObjectId(id) };

      const result = await menuCollection.deleteOne(query);
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

    // payment integration stripe

    // third step
    // for payment history api
    app.get('/payments/:email', verifyToken, async (req, res) => {
      const query = { email: req.params.email };
      if (req.params.email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      const result = await paymentDetailCollection.find(query).toArray();
      res.send(result);
    });

    // first step payment intent
    app.post('/create-payment-intent', async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      console.log(amount, 'amount inside the intent');

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card'],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // second step get data from client site for save payment details

    app.post('/payments', async (req, res) => {
      const payment = req.body;
      console.log('payment result', payment);
      const paymentResult = await paymentDetailCollection.insertOne(payment);

      //  carefully delete each item from the cart
      console.log('payment info', payment);
      const query = {
        _id: {
          $in: payment.cartIds.map(id => new ObjectId(id)),
        },
      };

      const deleteResult = await cartsCollection.deleteMany(query);

      res.send({ paymentResult, deleteResult });
    });

    // admin dashboard home statistics

    app.get('/admin-stats', verifyToken, verifyAdmin, async (req, res) => {
      const users = await userCollection.estimatedDocumentCount();
      const menuItems = await menuCollection.estimatedDocumentCount();
      const orders = await paymentDetailCollection.estimatedDocumentCount();
      // this is not best way
      // const payments = await paymentDetailCollection.find().toArray();
      // const revenue = payments.reduce((total, payment) => {
      //   total + payment.price;
      // }, 0);

      const result = await paymentDetailCollection
        .aggregate([
          {
            $group: {
              _id: null,
              totalRevenue: { $sum: '$price' },
            },
          },
        ])
        .toArray();
      const revenue = result.length > 0 ? result[0].totalRevenue : 0;
      res.send({ users, menuItems, orders, revenue });
    });

    // orders stats aggregate

    app.get('/order-stats', verifyToken, verifyAdmin, async (req, res) => {
      const result = await paymentDetailCollection
        .aggregate([
          {
            $unwind: '$menuItemIds',
          },
          {
            $lookup: {
              from: 'Menu',
              let: { menuItemId: { $toObjectId: '$menuItemIds' } },
              pipeline: [
                { $match: { $expr: { $eq: ['$_id', '$$menuItemId'] } } },
              ],
              as: 'menuItems',
            },
          },
          {
            $unwind: '$menuItems',
          },
          {
            $group: {
              _id: '$menuItems.category',
              quantity: {
                $sum: 1,
              },
              revenue: {
                $sum: '$menuItems.price',
              },
            },
          },
          {
            $project: {
              _id: 0,
              category: '$_id',
              quantity: '$quantity',
              revenue: '$revenue',
            },
          },
        ])
        .toArray();
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
