// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;

contract charity_Platform {
    struct User {
        bool registered;
        uint256 credits;
    }

    struct Campaign {
        uint256 campaignId;
        address creator;
        string title;
        string description;
        uint256 goal;
        uint256 raisedAmount;
        bool completed;
    }

    mapping(address => User) public users;
    mapping(uint256 => Campaign) public campaigns;

    uint256 public userCounter;
    uint256 public campaignCount;
    uint256 public constant initialCredits = 1000;

    address public owner;

    event RegistrationSuccess(address _userAddr);
    event CreditAdded(address _userAddr, uint256 _amount);
    event CampaignCreated(
        uint256 indexed _campaignId,
        address indexed _creator
    );
    event DonationReceived(
        address indexed donor,
        uint256 indexed campaignId,
        uint256 amount
    );
    event WithdrawalSuccess(
        address indexed user,
        uint256 indexed campaignId,
        uint256 amount
    );

    event DebugLog(string message, uint256 value);
    event DebugLogAddress(string message, address addr);

    modifier userMustNotExist(address _user) {
        require(!users[_user].registered, "User already registered");
        _;
    }

    modifier userMustExist(address _user) {
        require(users[_user].registered, "User not registered");
        _;
    }

    modifier onlyOwner() {
        require(
            msg.sender == owner,
            "Only contract owner can call this function"
        );
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function registerUser(address addr) public userMustNotExist(addr) {
        users[addr] = User(true, initialCredits);
        userCounter++;
        emit RegistrationSuccess(addr);
    }

    function getUserCredits(
        address addr
    ) public view userMustExist(addr) returns (uint256) {
        return users[addr].credits;
    }

    function addCredits(
        address addr,
        uint256 amount
    ) public userMustExist(addr) onlyOwner {
        users[addr].credits += amount;
        emit CreditAdded(addr, amount);
    }

    function createCampaign(
        string memory _title,
        string memory _description,
        uint256 _goal
    ) public {
        campaignCount++;
        campaigns[campaignCount] = Campaign(
            campaignCount,
            msg.sender,
            _title,
            _description,
            _goal,
            0,
            false
        );
        emit CampaignCreated(campaignCount, msg.sender);
    }

    function getCampaignDetails(
        uint256 _campaignId
    ) public view returns (Campaign memory) {
        require(_campaignId <= campaignCount, "Invalid campaign ID");
        return campaigns[_campaignId];
    }

    function donate(uint256 _campaignId, uint256 _amount) public {
        require(
            _campaignId > 0 && _campaignId <= campaignCount,
            "Invalid campaign ID"
        );
        require(_amount > 0, "Invalid donation amount");

        Campaign storage campaign = campaigns[_campaignId];
        require(!campaign.completed, "Campaign already completed");

        // Verifikasi kredit pengguna
        require(users[msg.sender].credits >= _amount, "Insufficient credit");

        // Kurangi kredit pengguna
        users[msg.sender].credits -= _amount;

        // Update jumlah yang terkumpul pada kampanye
        campaign.raisedAmount += _amount;

        // Jika raised amount mencapai atau melebihi goal, tandai kampanye sebagai selesai
        if (campaign.raisedAmount >= campaign.goal) {
            campaign.completed = true;
        }

        // Emit event untuk merekam donasi yang diterima
        emit DonationReceived(msg.sender, _campaignId, _amount);
    }

    function withdrawFunds(
        uint256 _campaignId,
        address addr
    ) public userMustExist(addr) {
        // Memastikan kampanye sudah selesai
        require(campaigns[_campaignId].completed, "Campaign not completed");

        // Memastikan pengguna telah berdonasi pada kampanye
        require(users[addr].registered, "User not registered for withdrawal");

        require(
            campaigns[_campaignId].raisedAmount > 0,
            "No funds to withdraw"
        );

        // Mengembalikan kredit pengguna
        users[addr].credits += campaigns[_campaignId].raisedAmount;

        // Emit event untuk merekam penarikan dana
        emit WithdrawalSuccess(
            addr,
            _campaignId,
            campaigns[_campaignId].raisedAmount
        );
    }
}
