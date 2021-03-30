pragma solidity >=0.7.0 <0.8.0;

contract L2DepositTracker {
    struct L2DepositMetadata {
        uint256 initiatedTimestamp;
        uint256 initiatedBlockNumber;
        address depositerAddress;
        uint256 receivedTimestamp;
        uint256 receivedBlockNumber;
        uint256 depositIndex;
    }

    L2DepositMetadata[] public l2Deposits;
    function completeDeposit(
        uint256 _depositIndex,
        address _depositerAddress,
        uint256 _initiatedTimestamp,
        uint256 _initiatedBlockNumber
    ) public {
        l2Deposits.push(
            L2DepositMetadata({
                depositIndex: _depositIndex,
                depositerAddress: _depositerAddress,
                initiatedTimestamp: _initiatedTimestamp,
                initiatedBlockNumber: _initiatedBlockNumber,
                receivedTimestamp: block.timestamp,
                receivedBlockNumber: block.number
            })
        );
    }

    function numDeposits() public view returns(uint count) {
        return l2Deposits.length;
    }
}