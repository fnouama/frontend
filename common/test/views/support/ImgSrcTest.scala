package views.support

import org.joda.time.DateTime
import org.scalatest.FlatSpec
import org.scalatest.Matchers
import model.{ImageContainer, ImageAsset}
import com.gu.contentapi.client.model.{Content, Asset, Tag, Element}
import conf.Switches.{ImageServerSwitch, PngResizingSwitch}
import conf.Configuration


class ImgSrcTest extends FlatSpec with Matchers  {

  val imageHost = Configuration.images.path

  val asset = Asset(
    "image",
    Some("image/jpeg"),
    Some("http://static.guim.co.uk/sys-images/Guardian/Pix/pictures/2013/7/5/1373023097878/b6a5a492-cc18-4f30-9809-88467e07ebfa-460x276.jpeg"),
    Map.empty[String, String]
  )

  val element = Element("elementId", "main", "image", Some(1), List(asset))

  val tag = List(Tag(id = "type/article", `type` = "keyword", webTitle = "",
      sectionId = None, sectionName = None, webUrl = "", apiUrl = "apiurl", references = Nil))

  val content = Content("foo/2012/jan/07/bar", None, None, Some(new DateTime), "Some article",
      "http://www.guardian.co.uk/foo/2012/jan/07/bar",
      "http://content.guardianapis.com/foo/2012/jan/07/bar",
      tags = tag,
      elements = Some(List(element))
    )

  val imageAsset = ImageAsset(asset, 1)

  val image = ImageContainer(Seq(imageAsset), element, imageAsset.index) // yep null, sorry but the tests don't need it

  val mediaImageAsset = ImageAsset(Asset(
    "image",
    Some("image/jpeg"),
    Some("http://media.guim.co.uk/knly7wcp46fuadowlsnitzpawm/437_0_3819_2291/1000.jpg"),
    Map.empty[String, String]
  ), 1)

  val mediaImage = ImageContainer(Seq(mediaImageAsset), element, mediaImageAsset.index)


  "ImgSrc" should "convert the URL of a static image to the resizing endpoint with a /static prefix" in {
    ImageServerSwitch.switchOn()
      Item700.bestFor(image) should be (Some(s"$imageHost/static/w-700/h--/q-95/sys-images/Guardian/Pix/pictures/2013/7/5/1373023097878/b6a5a492-cc18-4f30-9809-88467e07ebfa-460x276.jpeg"))
  }

  it should "convert the URL of a media service to the resizing endpoint with a /media prefix" in {
    ImageServerSwitch.switchOn()
      Item700.bestFor(mediaImage) should be (Some(s"$imageHost/media/w-700/h--/q-95/knly7wcp46fuadowlsnitzpawm/437_0_3819_2291/1000.jpg"))
  }

  it should "not convert the URL of the image if it is disabled" in {
    ImageServerSwitch.switchOff()
    Item700.bestFor(image) should be (Some("http://static.guim.co.uk/sys-images/Guardian/Pix/pictures/2013/7/5/1373023097878/b6a5a492-cc18-4f30-9809-88467e07ebfa-460x276.jpeg"))
  }

  it should "convert the URL of the image if it is a PNG" in {
    ImageServerSwitch.switchOn()
    PngResizingSwitch.switchOn()
    val pngImage = ImageContainer(Seq(ImageAsset(asset.copy(file = Some("http://static.guim.co.uk/sys-images/Guardian/Pix/contributor/2014/10/30/1414675415419/Jessica-Valenti-R.png")),0)), element, 0)
    Item700.bestFor(pngImage) should be (Some(s"$imageHost/static/w-700/h--/q-95/sys-images/Guardian/Pix/contributor/2014/10/30/1414675415419/Jessica-Valenti-R.png"))
  }

  it should "not convert the URL of the image if it is a GIF (we do not support animated GIF)" in {
    ImageServerSwitch.switchOn()
    val gifImage = ImageContainer(Seq(ImageAsset(asset.copy(file = Some("http://static.guim.co.uk/sys-images/Guardian/Pix/pictures/2013/7/5/1373023097878/b6a5a492-cc18-4f30-9809-88467e07ebfa-460x276.gif")),0)), element, 0)
    Item700.bestFor(gifImage) should be (Some("http://static.guim.co.uk/sys-images/Guardian/Pix/pictures/2013/7/5/1373023097878/b6a5a492-cc18-4f30-9809-88467e07ebfa-460x276.gif"))
  }

  it should "not convert the URL of the image if it is not one of ours" in {
    ImageServerSwitch.switchOn()
    val someoneElsesImage = ImageContainer(Seq(ImageAsset(asset.copy(file = Some("http://foo.co.uk/sys-images/Guardian/Pix/pictures/2013/7/5/1373023097878/b6a5a492-cc18-4f30-9809-88467e07ebfa-460x276.gif")),0)), element, 0)
    Item700.bestFor(someoneElsesImage) should be (Some("http://foo.co.uk/sys-images/Guardian/Pix/pictures/2013/7/5/1373023097878/b6a5a492-cc18-4f30-9809-88467e07ebfa-460x276.gif"))
  }
}
