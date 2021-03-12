pragma solidity >=0.7.0;

contract BlockNumberStorage {
    mapping (uint256 => uint256) public blockNumbers;
    uint256 public index = 0;

    fallback() external {
        blockNumbers[index] = block.number;
        index++;
    }
}
