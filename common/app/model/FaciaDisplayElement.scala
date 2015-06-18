package model

import com.gu.facia.api.models.FaciaContent
import conf.Switches
import implicits.FaciaContentImplicits._
import implicits.FaciaContentFrontendHelpers._
import conf.{Switches,Configuration}
import layout.ItemClasses

object FaciaDisplayElement {
  def fromFaciaContentAndCardType(faciaContent: FaciaContent, itemClasses: ItemClasses): Option[FaciaDisplayElement] = {
    faciaContent.mainVideo match {
      case Some(videoElement) if faciaContent.showMainVideo =>
        Some(InlineVideo(
          videoElement,
          faciaContent.webTitle,
          EndSlateComponents.fromFaciaContent(faciaContent).toUriPath,
          InlineImage.fromFaciaContent(faciaContent)
        ))
      case _ if faciaContent.isCrossword && Switches.CrosswordSvgThumbnailsSwitch.isSwitchedOn =>
        Some(CrosswordSvg(faciaContent.id))
      case _ if faciaContent.imageSlideshowReplace && itemClasses.canShowSlideshow =>
        InlineSlideshow.fromFaciaContent(faciaContent)
      case _ => InlineImage.fromFaciaContent(faciaContent)
    }
  }
}

sealed trait FaciaDisplayElement

case class InlineVideo(
  videoElement: VideoElement,
  title: String,
  endSlatePath: String,
  fallBack: Option[InlineImage]
) extends FaciaDisplayElement

object InlineImage {
  def fromFaciaContent(faciaContent: FaciaContent): Option[InlineImage] =
    if (!faciaContent.imageHide) {
      faciaContent.trailPicture(5, 3) map { picture =>
        InlineImage(picture)
      }
    } else {
      None
    }
}

case class InlineImage(imageContainer: ImageContainer) extends FaciaDisplayElement

case class CrosswordSvg(id: String) extends FaciaDisplayElement {
  def persistenceId = id.stripPrefix("crosswords/")

  def imageUrl = s"${Configuration.ajax.url}/$id.svg"
}

object InlineSlideshow {
  def fromTrail(trail: Trail): Option[InlineSlideshow] =
    Option(InlineSlideshow(trail.trailSlideshow(5, 3)))

  def fromFaciaContent(faciaContent: FaciaContent): Option[InlineSlideshow] =
    for (s <- faciaContent.slideshow) yield InlineSlideshow(s)
}

case class InlineSlideshow(images: Iterable[FaciaImageElement]) extends FaciaDisplayElement
