import { Route, Switch } from "wouter";
import Home from "./Home";
import Admin from "./Admin";
import Legal from "./Legal";
import "./styles.css";
import { useSite } from "./site";

function NotFound() { return <Home />; }

export default function App() {
  useSite();
  return <Switch>
    <Route path="/admin" component={Admin} />
    <Route path="/privacy">{() => <Legal type="privacy" />}</Route>
    <Route path="/terms">{() => <Legal type="terms" />}</Route>
    <Route path="/" component={Home} />
    <Route path="/:rest*" component={Home} />
    <Route component={NotFound} />
  </Switch>;
}
