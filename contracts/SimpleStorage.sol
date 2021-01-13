pragma solidity ^0.5.16;

contract ICrossDomainMessenger {
    address public xDomainMessageSender;
}

contract SimpleStorage {
    address public msgSender;
    address public xDomainSender;
    bytes32 public value;
    uint256 public totalCount;

    function setValue(bytes32 newValue) public {
        msgSender = msg.sender;
        xDomainSender = ICrossDomainMessenger(msg.sender)
            .xDomainMessageSender();
        value = newValue;
        totalCount++;
    }

    function dumbSetValue(bytes32 newValue) public {
        value = newValue;
    }
}
