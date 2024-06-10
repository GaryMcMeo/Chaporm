import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import express from 'express';
import session from 'express-session';
import mysql from 'mysql2/promise';
import path from 'path';
import { fileURLToPath } from 'url';
import * as tools from './tools.mjs';

const app = express();
const port = 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RC = await tools.constructSmartContract();

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'charity_platform'
};

const pool = mysql.createPool(dbConfig);

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use('/static', express.static('src'));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true,
}));

// Routing untuk halaman register
app.get('/', async (request, response) => {
    response.render("register", { error: null });
});

// Endpoint untuk menangani pendaftaran pengguna
app.post('/register', async (request, response) => {
    let contract;
    try {
        var addr = request.body.address;
        var pwd = request.body.password;
        console.log('User address:', addr);
        contract = await tools.constructSmartContract();
        let tx = await contract.registerUser(addr);
        await tx.wait();
        console.log('Transaction:', tx);

        // Simpan pengguna ke database dengan kredit awal
        const connection = await pool.getConnection();
        try {
            const [rows] = await connection.query('INSERT INTO users (address, password, credits) VALUES (?, ?, ?)', [addr, pwd, 1000]);
            console.log('User saved to database:', rows);
        } finally {
            connection.release();
        }
        response.redirect('/login');
    } catch (err) {
        console.error("Error registering user on smart contract:", err);
        // Tetap tampilkan halaman pendaftaran dengan pesan kesalahan
        return response.render("register", { error: "Error registering user on smart contract" });
    }
});

// Routing untuk halaman login
app.get('/login', (request, response) => {
    response.render('login');
});

// Endpoint untuk menangani login pengguna
app.post('/login', async (request, response) => {
    const { address, password } = request.body;
    try {
        const connection = await pool.getConnection();
        try {
            const [rows] = await connection.query('SELECT * FROM users WHERE address = ? AND password = ?', [address, password]);
            if (rows.length > 0) {
                // Simpan alamat pengguna ke dalam sesi
                request.session.address = address;
                response.redirect('/profile');
            } else {
                response.status(401).send('Invalid address or password');
            }
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error('Error logging in user:', err);
        response.status(500).send('Error logging in user');
    }
});

// Routing untuk halaman profil
app.get('/profile', async (request, response) => {
    try {
        // Ambil alamat pengguna dari sesi
        const userAddress = request.session.address;
        // Panggil fungsi getUserCredits dari kontrak pintar untuk mendapatkan saldo kredit
        const userCredits = await RC.getUserCredits(userAddress);
        // Render halaman profil dengan data pengguna
        response.render('profile', { users: { address: userAddress, balance: userCredits }, error: null });
    } catch (error) {
        console.error('Error rendering profile page:', error);
        response.status(500).send('Error rendering profile page');
    }
});

// Endpoint untuk menangani penambahan kredit
app.post('/profile', async (request, response) => {
    try {
        // Ambil alamat pengguna dari sesi
        const userAddress = request.session.address;
        // Ambil jumlah kredit yang ingin ditambahkan dari permintaan
        const creditAmount = request.body.amount;
        // Panggil fungsi addCredits dari kontrak pintar untuk menambahkan kredit
        const tx = await RC.addCredits(userAddress, creditAmount);
        await tx.wait();

        // Perbarui kredit pengguna di database
        const connection = await pool.getConnection();
        try {
            await connection.query('UPDATE users SET credits = credits + ? WHERE address = ?', [creditAmount, userAddress]);
        } finally {
            connection.release();
        }
        response.redirect('/profile');
    } catch (error) {
        console.error('Error adding credits:', error);
        response.status(500).send('Error adding credits');
    }
});

// Routing
app.get('/create_campaign', (request, response) => {
    response.render('create_campaign');
});

app.post("/create_campaign", async (request, response) => {
    try {
        const creator = request.session.address;
        const { title, description, goal } = request.body;
        // Validasi input
        if (!creator || !title || !description || !goal) {
            console.error("Invalid request body:", request.body);
            return response.status(400).send("Invalid request body");
        }
        // Panggil fungsi createCampaign dari kontrak pintar Ethereum
        const RC = await tools.constructSmartContract(creator);
        const tx = await RC.createCampaign(title, description, goal);
        await tx.wait();
        console.log("Campaign created successfully on smart contract:", title);
        // Ambil campaignId dari campaignCount setelah kampanye dibuat
        const campaignId = await RC.campaignCount();
        // Simpan data kampanye bersama dengan campaignId ke dalam database
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            // Simpan data kampanye ke dalam database
            const sql = "INSERT INTO campaigns (campaignId, creator, title, description, goal, raisedAmount) VALUES (?, ?, ?, ?, ?, 0)";
            await connection.execute(sql, [campaignId, creator, title, description, goal]);
            await connection.commit();
        } catch (error) {
            await connection.rollback(); // Rollback transaksi jika terjadi kesalahan
            throw error;
        } finally {
            connection.release();
        }
        response.redirect("/my_campaign");
    } catch (error) {
        console.error("Error creating campaign on smart contract:", error);
        return response.status(500).send("Error creating campaign on smart contract");
    }
});

// Routing home
app.get('/home', async (request, response) => {
    try {
        const RC = await tools.constructSmartContract(request.session.address);
        // Get the total number of campaigns
        const campaignCount = await RC.campaignCount();
        // Initialize an array to store all campaigns
        let allCampaigns = [];
        // Iterate through each campaign ID and get its details
        for (let campaignId = 1; campaignId <= campaignCount; campaignId++) {
            const campaignDetails = await RC.getCampaignDetails(campaignId);
            allCampaigns.push(campaignDetails);
        }
        response.render('home', { campaigns: allCampaigns });
    } catch (error) {
        console.error('Error rendering home page:', error);
        response.status(500).send('Error rendering home page');
    }
});

app.post('/donate', async (req, res) => {
    try {
        const campaignId = req.body.campaignId;
        const amount = parseInt(req.body.amount, 10);

        if (!campaignId || !amount || isNaN(amount) || amount <= 0) {
            return res.status(400).send('Invalid campaignId or amount');
        }

        const userAddress = req.session.address;

        if (!userAddress) {
            return res.status(401).send('Unauthorized: No session address found');
        }
        // Get user credits from the database
        let userCredits;
        try {
            const connection = await pool.getConnection();
            const [rows] = await connection.execute('SELECT credits FROM users WHERE address = ?', [userAddress]);
            connection.release();
            if (rows.length > 0) {
                userCredits = rows[0].credits;
            } else {
                return res.status(404).send('User not found');
            }
        } catch (err) {
            console.error('Error fetching user credits:', err);
            return res.status(500).send('Error fetching user credits');
        }
        // Ensure user has enough credits
        if (userCredits < amount) {
            return res.status(400).send('Insufficient credit');
        }
        // Call the donate function on the smart contract
        try {
            const RC = await tools.constructSmartContract(userAddress);
            const tx = await RC.donate(campaignId, amount);
            await tx.wait();
        } catch (err) {
            console.error('Error calling smart contract donate function:', err);
            return res.status(500).send('Error donating');
        }
        // Update user credits in the database
        try {
            const connection = await pool.getConnection();
            await connection.execute('UPDATE users SET credits = credits - ? WHERE address = ?', [amount, userAddress]);
            connection.release();
        } catch (err) {
            console.error('Error updating user credits:', err);
            return res.status(500).send('Error updating user credits');
        }
        // Update raised amount in the database
        try {
            const connection = await pool.getConnection();
            await connection.execute('UPDATE campaigns SET raisedAmount = raisedAmount + ? WHERE campaignId = ?', [amount, campaignId]);
            connection.release();
        } catch (err) {
            console.error('Error updating campaign raisedAmount:', err);
            return res.status(500).send('Error updating campaign raisedAmount');
        }
        // Get the updated campaign details from the smart contract
        let campaignDetails;
        try {
            const RC = await tools.constructSmartContract(userAddress);
            campaignDetails = await RC.getCampaignDetails(campaignId);
        } catch (err) {
            console.error('Error fetching updated campaign details from smart contract:', err);
            return res.status(500).send('Error fetching updated campaign details');
        }
        // Update campaign status in the database if it is completed
        if (campaignDetails.completed) {
            try {
                const connection = await pool.getConnection();
                await connection.execute('UPDATE campaigns SET completed = ? WHERE campaignId = ?', [campaignDetails.completed, campaignId]);
                connection.release();
            } catch (err) {
                console.error('Error updating campaign status in database:', err);
                return res.status(500).send('Error updating campaign status in database');
            }
        }
        res.redirect('/home');
    } catch (error) {
        console.error('Error donating:', error);
        res.status(500).send('Error donating');
    }
});

app.get('/my_campaign', async (request, response) => {
    try {
        if (!request.session || !request.session.address) {
            return response.status(401).send('Unauthorized: No session address found');
        }
        // Ambil campaign pengguna dari database
        const connection = await pool.getConnection();
        try {
            const [userCampaigns] = await connection.execute(
                'SELECT * FROM campaigns WHERE creator = ?',
                [request.session.address]
            );
            response.render('my_campaign', { campaigns: userCampaigns });
        } finally {
            connection.release(); // Melepaskan koneksi
        }
    } catch (error) {
        console.error('Error rendering my_campaign page:', error);
        response.status(500).send('Error rendering my_campaign page');
    }
});

app.post('/withdraw', async (req, res) => {
    try {
        const campaignId = req.body.campaignId;

        if (!campaignId) {
            return res.status(400).send('Invalid campaignId');
        }

        const userAddress = req.session.address;

        if (!userAddress) {
            return res.status(401).send('Unauthorized: No session address found');
        }

        // Panggil fungsi withdrawFunds dari kontrak pintar dengan parameter addr
        const RC = await tools.constructSmartContract(userAddress);
        const tx = await RC.withdrawFunds(campaignId, userAddress);
        await tx.wait();

        // Log untuk memeriksa kredit pengguna setelah penarikan
        const userCredits = await RC.getUserCredits(userAddress);
        console.log(`User credits after withdrawal: ${userCredits.toString()}`);

        // Dapatkan jumlah dana yang ditarik dari kampanye (misalkan dari smart contract atau database)
        const connection = await pool.getConnection();
        let raisedAmount;
        try {
            const [rows] = await connection.execute('SELECT raisedAmount FROM campaigns WHERE campaignId = ?', [campaignId]);
            if (rows.length > 0) {
                raisedAmount = rows[0].raisedAmount;
            } else {
                return res.status(404).send('Campaign not found');
            }
        } finally {
            connection.release();
        }

        // Perbarui kredit pengguna di database
        try {
            const connection = await pool.getConnection();
            await connection.execute('UPDATE users SET credits = credits + ? WHERE address = ?', [raisedAmount, userAddress]);
            connection.release();
        } catch (err) {
            console.error('Error updating user credits:', err);
            return res.status(500).send('Error updating user credits');
        }

        // Hapus kampanye dari database
        try {
            const connection = await pool.getConnection();
            await connection.execute('DELETE FROM campaigns WHERE campaignId = ?', [campaignId]);
            connection.release();
        } catch (err) {
            console.error('Error deleting campaign:', err);
            return res.status(500).send('Error deleting campaign');
        }

        res.redirect('/my_campaign');
    } catch (error) {
        console.error('Error withdrawing funds:', error);
        res.status(500).send('Error withdrawing funds');
    }
});

const syncCampaignStatus = async () => {
    try {
        const connection = await pool.getConnection();
        const [campaigns] = await connection.query('SELECT campaignId FROM campaigns WHERE completed = 0');

        for (let i = 0; i < campaigns.length; i++) {
            const campaignId = campaigns[i].campaignId;
            const RC = await tools.constructSmartContract();  // Adjust this if needed
            const campaignDetails = await RC.getCampaignDetails(campaignId);

            if (campaignDetails.completed) {
                await connection.query('UPDATE campaigns SET completed = ? WHERE campaignId = ?', [campaignDetails.completed, campaignId]);
            }
        }

        connection.release();
    } catch (error) {
        console.error('Error syncing campaign status:', error);
    }
};

// Call syncCampaignStatus at appropriate intervals
setInterval(syncCampaignStatus, 60000);

// Jalankan server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
