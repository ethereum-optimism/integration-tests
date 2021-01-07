pragma solidity ^0.5.16;

contract ICrossDomainMessenger {
    address public xDomainMessageSender;
}

contract L1SimpleStorage {
    address public msgSender;
    address public l2ToL1Sender;
    bytes32 public value;
    uint public totalCount;
    function setValue(bytes32 newValue) public {
        msgSender = msg.sender;
        l2ToL1Sender = ICrossDomainMessenger(msg.sender).xDomainMessageSender();
        value = newValue;
        totalCount++;
    }

    function dumbSetValue(bytes32 newValue) public {
        value = newValue;
    }
}