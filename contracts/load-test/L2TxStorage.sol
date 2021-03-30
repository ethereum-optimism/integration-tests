pragma solidity >=0.7.0 <0.8.0;

contract L2TxStorage {
    struct L2TxMetadata {
        uint256 txIndex;
        address msgSender;
        uint256 realWorldTimeSent;
        uint256 timestampReceived;
    }
    L2TxMetadata[] public l2Txs;
    function sendTx(uint256 _txIndex, uint256 _realWorldTimeSent) public {
        l2Txs.push(
            L2TxMetadata({
                txIndex: _txIndex,
                realWorldTimeSent: _realWorldTimeSent,
                msgSender: msg.sender,
                timestampReceived: block.timestamp
            })
        );
    }

    function numTxs() public view returns(uint count) {
        return l2Txs.length;
    }
}