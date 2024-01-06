import styled from "styled-components";
import Row from "./Row";
import HomepageLogo from "./HomepageLogo";
import Button from "./Button";

const StyledHeader = styled.header`
  padding: 1.2 rem 4.8rem;
  grid-column: 1/-1;
  height: auto;
`;

const ButtonRow = styled(Row)`
  width: 160px;
`;
function Header() {
  return (
    <StyledHeader>
      <Row type="horizontal">
        <HomepageLogo />
        <ButtonRow type="horizontal">
          <Button size="medium">Log in</Button>
          <Button>Sign In</Button>
        </ButtonRow>
      </Row>
    </StyledHeader>
  );
}

export default Header;
