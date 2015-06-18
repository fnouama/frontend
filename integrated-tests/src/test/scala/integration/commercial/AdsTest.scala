package integration.commercial

import integration.SharedWebDriver
import integration.driver.Config
import org.openqa.selenium.support.ui.ExpectedConditions.presenceOfElementLocated
import org.openqa.selenium.support.ui.WebDriverWait
import org.openqa.selenium.{By, WebElement}
import org.scalatest.OptionValues._
import org.scalatest.tags.Retryable
import org.scalatest.{DoNotDiscover, FlatSpec, Matchers}

@DoNotDiscover
@Retryable
class AdsTest extends FlatSpec with Matchers with SharedWebDriver {

  override protected def get(path: String): Unit = {
    webDriver.get(s"${Config.baseUrl}/$path?test=test#gu.prefs.switchOn=adverts")
    webDriver.navigate().refresh()
  }

  private def waitForElement(selector: String): Unit = {
    new WebDriverWait(webDriver, 20).until(presenceOfElementLocated(By.cssSelector(selector)))
  }

  private def waitForAdLoad(domSlotId: String): Unit = waitForElement(s"#$domSlotId > div > iframe")

  private def findComponent(path: String, selector: String): Option[WebElement] = {
    get(path)
    waitForElement(selector)
    $(selector).headOption
  }

  private def findLogo(path: String, domSlotId: String): Option[WebElement] = {
    findComponent(path, s"#$domSlotId > div > a > img")
  }

  private def shouldBeVisible(maybeComponent: => Option[WebElement]): Unit = {
    maybeComponent.value shouldBe 'displayed
  }

  "Ads" should "display on the sport front" in {

    get("uk/sport")

    waitForAdLoad("dfp-ad--top-above-nav")

    withClue("Should display top banner ad") {
      $("#dfp-ad--top-above-nav > *").size should be > 0
    }

    waitForAdLoad("dfp-ad--inline1")
    waitForAdLoad("dfp-ad--inline2")

    withClue("Should display two MPUs") {
      $("#dfp-ad--inline1 > *").size should be > 0
      $("#dfp-ad--inline2 > *").size should be > 0
    }

  }

  "A logo" should "appear on a sponsored front" in {
    shouldBeVisible {
      findLogo(
        path = "voluntary-sector-network/series/the-not-for-profit-debates",
        domSlotId = "dfp-ad--spbadge1"
      )
    }
  }

  it should "appear on a sponsored article" in {
    shouldBeVisible {
      findLogo(
        path = "voluntary-sector-network/2015/apr/28/help-your-organisation-embrace-and-nurture" +
          "-change-in-a-fast-moving-world",
        domSlotId = "dfp-ad--spbadge"
      )
    }
  }
}
