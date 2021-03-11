pragma solidity ^0.5.16;

interface iOVM_CanonicalTransactionChain {
    /**
     * Adds a transaction to the queue.
     * @param _target Target contract to send the transaction to.
     * @param _gasLimit Gas limit for the given transaction.
     * @param _data Transaction data.
     */
    function enqueue(
        address _target,
        uint256 _gasLimit,
        bytes calldata _data
    ) external;
}

contract L1DepositInitiator {
    struct L1DepositMetadata {
        uint256 initiatedTimestamp;
        uint256 initiatedBlockNumber;
        address depositerAddress;
        uint256 depositIndex;
    }

    L1DepositMetadata[] public l1Deposits;
    function initiateDeposit(
        uint256 _depositIndex,
        address _ctcAddress,
        address _targetAddress
    ) public {
        bytes memory data = abi.encodeWithSignature(
            "completeDeposit(uint256,address,uint256,uint256)",
            _depositIndex,
            msg.sender,
            block.timestamp,
            block.number
        );
        iOVM_CanonicalTransactionChain(_ctcAddress).enqueue(
            _targetAddress,
            8000000,
            data
        );
        l1Deposits.push(
            L1DepositMetadata({
                depositIndex: _depositIndex,
                depositerAddress: msg.sender,
                initiatedTimestamp: block.timestamp,
                initiatedBlockNumber: block.number
            })
        );
    }

    function numDeposits() public view returns(uint count) {
        return l1Deposits.length;
    }
}