package test

import play.api.test.Helpers._
import org.scalatest.{DoNotDiscover, Matchers, FlatSpec}
import scala.collection.JavaConversions._

@DoNotDiscover class InteractiveControllerTest extends FlatSpec with Matchers with ConfiguredTestSuite {

  val url = "music/interactive/2013/aug/20/matthew-herbert-quiz-hearing"

  "Interactive Controller" should "200 when content type is 'interactive'" in {
    val result = controllers.InteractiveController.renderInteractive(url)(TestRequest(url))
    status(result) should be(200)
  }

  it should "hide all ui for immersive content"  in goTo("/lifeandstyle/ng-interactive/2015/feb/12/watch-me-date") { browser =>
    import browser._
    $(".content__head").length should be (0)
  }
}
