pragma solidity ^0.5.16;

contract ICrossDomainMessenger {
    address public xDomainMessageSender;
}

contract SimpleStorage {
    address public msgSender;
    address public l1ToL2Sender;
    bytes32 public value;
    uint public totalCount;
    function setValue(bytes32 newValue) public {
        msgSender = msg.sender;
        l1ToL2Sender = ICrossDomainMessenger(msg.sender).xDomainMessageSender();
        value = newValue;
        totalCount++;
    }
}